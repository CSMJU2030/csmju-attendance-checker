import { AddressInfo } from 'net';
import { IncomingMessage, ServerResponse, createServer, Server } from 'http';
import { decodeJwt } from 'jose';
import { TestSigningKey, jwksDocument } from './token-factory';

/** An answer Core Hub gives instead of data. */
export interface CoreHubFailure {
  status: number;
  /** The Retry-After header, e.g. "120". */
  retryAfter?: string;
}

/**
 * A minimal stand-in for Core Hub, used by the e2e suite. It serves what the
 * subsystem reads from the real Core Hub: the JWKS document (public keys
 * only), the rooms reference data (GET /api/v1/rooms) and the caller's own
 * person (GET /api/v1/people/me) - the last two need a Bearer token like the
 * real ones.
 */
export class FakeCoreHub {
  private server?: Server;
  private keys: TestSigningKey[] = [];
  private rooms: Array<Record<string, unknown> & { isActive: boolean }> = [];

  /** JWKS downloads. */
  requestCount = 0;
  /** GET /api/v1/rooms calls. */
  roomRequests = 0;
  /** The Authorization header of the latest rooms call. */
  lastRoomsAuthorization: string | undefined;
  /**
   * While set, reference data answers with this status (and Retry-After), as
   * Core Hub does when it is down (503), rate limiting (429) or has ended the
   * user's session (401).
   */
  referenceDataFailure: CoreHubFailure | null = null;

  /** GET /api/v1/people/me calls. */
  peopleRequests = 0;
  /** The Authorization header of the latest /people/me call. */
  lastPeopleAuthorization: string | undefined;
  /** While set, /people/me answers with this status instead. */
  peopleFailure: CoreHubFailure | null = null;
  /** The person linked to each account, by `sub`; anyone else is linked to none. */
  private people = new Map<string, Record<string, unknown>>();
  /** Everyone GET /api/v1/people lists (the directory, not linked accounts). */
  private directory: Array<Record<string, unknown>> = [];
  private departments: Array<Record<string, unknown> & { isActive: boolean }> = [];
  private courses: Array<Record<string, unknown> & { isActive: boolean }> = [];
  /** Query strings of GET /api/v1/people calls, in order. */
  peopleListQueries: string[] = [];

  async start(keys: TestSigningKey[]): Promise<void> {
    this.keys = keys;
    this.server = createServer((req, res) => {
      if (req.url?.startsWith('/api/v1/.well-known/jwks.json')) {
        this.requestCount += 1;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(jwksDocument(this.keys)));
        return;
      }
      if (req.url?.startsWith('/api/v1/rooms')) {
        this.serveRooms(req, res);
        return;
      }
      if (req.url?.startsWith('/api/v1/people/me')) {
        this.servePeopleMe(req, res);
        return;
      }
      if (req.url === '/api/v1/people' || req.url?.startsWith('/api/v1/people?')) {
        this.servePeopleList(req, res);
        return;
      }
      if (req.url?.startsWith('/api/v1/departments')) {
        this.serveDepartments(req, res);
        return;
      }
      if (req.url?.startsWith('/api/v1/courses')) {
        this.serveReference(req, res, this.courses);
        return;
      }
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
    });

    await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', resolve));
  }

  /** Simulates Core Hub key rotation. */
  rotate(keys: TestSigningKey[]): void {
    this.keys = keys;
  }

  /** The rooms Core Hub holds, in the shape of its GET /api/v1/rooms. */
  setRooms(rooms: Array<Record<string, unknown> & { isActive: boolean }>): void {
    this.rooms = rooms;
  }

  /** The people directory behind GET /api/v1/people. */
  setDirectory(people: Array<Record<string, unknown>>): void {
    this.directory = people;
  }

  /** The courses reference data behind GET /api/v1/courses (closed ones too). */
  setCourses(courses: Array<Record<string, unknown> & { isActive: boolean }>): void {
    this.courses = courses;
  }

  /** The departments reference data behind GET /api/v1/departments. */
  setDepartments(departments: Array<Record<string, unknown> & { isActive: boolean }>): void {
    this.departments = departments;
  }

  /** People Core Hub has linked to accounts, by the account's `sub`. */
  setPeople(people: Record<string, Record<string, unknown>>): void {
    this.people = new Map(Object.entries(people));
  }

  /**
   * GET /api/v1/people/me as Core Hub answers it: the person linked to the
   * caller's `sub`, `data: null` when there is none, and 403 for a guest.
   * The fake reads the claims without verifying them - the subsystem did.
   */
  private servePeopleMe(req: IncomingMessage, res: ServerResponse): void {
    this.peopleRequests += 1;
    this.lastPeopleAuthorization = req.headers.authorization;

    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(body));
    };

    const token = /^Bearer (\S+)$/.exec(req.headers.authorization ?? '')?.[1];
    let claims: { sub?: unknown; role?: unknown } | undefined;
    try {
      claims = token ? decodeJwt(token) : undefined;
    } catch {
      claims = undefined;
    }
    if (!claims) {
      send(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'token required' } });
      return;
    }
    if (this.peopleFailure) {
      this.fail(res, this.peopleFailure);
      return;
    }
    if (claims.role === 'guest') {
      send(403, { success: false, error: { code: 'FORBIDDEN', message: 'people:me:read' } });
      return;
    }

    send(200, {
      success: true,
      data: this.people.get(String(claims.sub)) ?? null,
      requestId: 'fake-core-hub',
      timestamp: new Date().toISOString(),
    });
  }

  /** The reference data contract: paged envelope, open rooms unless includeInactive=true. */
  private serveRooms(req: IncomingMessage, res: ServerResponse): void {
    this.roomRequests += 1;
    this.lastRoomsAuthorization = req.headers.authorization;

    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    if (!/^Bearer \S+$/.test(req.headers.authorization ?? '')) {
      send(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'token required' } });
      return;
    }
    if (this.referenceDataFailure) {
      this.fail(res, this.referenceDataFailure);
      return;
    }

    const query = new URL(req.url ?? '/', 'http://core-hub.test').searchParams;
    const page = Number(query.get('page') ?? '1');
    const limit = Number(query.get('limit') ?? '20');
    const rooms =
      query.get('includeInactive') === 'true' ? this.rooms : this.rooms.filter((room) => room.isActive);

    send(200, {
      success: true,
      data: rooms.slice((page - 1) * limit, page * limit),
      meta: { total: rooms.length, page, limit, totalPages: Math.max(1, Math.ceil(rooms.length / limit)) },
      requestId: 'fake-core-hub',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * GET /api/v1/people for staff, lecturer and admin tokens (`people:read`):
   * filters by personType, status (default ACTIVE), departmentCode, entryYear and q.
   */
  private servePeopleList(req: IncomingMessage, res: ServerResponse): void {
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(body));
    };
    const token = /^Bearer (\S+)$/.exec(req.headers.authorization ?? '')?.[1];
    let claims: { role?: unknown } | undefined;
    try {
      claims = token ? decodeJwt(token) : undefined;
    } catch {
      claims = undefined;
    }
    if (!claims) {
      send(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'token required' } });
      return;
    }
    if (!['staff', 'lecturer', 'admin'].includes(String(claims.role))) {
      send(403, { success: false, error: { code: 'FORBIDDEN', message: 'people:read' } });
      return;
    }
    const url = new URL(req.url ?? '/', 'http://core-hub.test');
    this.peopleListQueries.push(url.search);
    const query = url.searchParams;
    const page = Number(query.get('page') ?? '1');
    const limit = Number(query.get('limit') ?? '20');
    const status = query.get('status') ?? 'ACTIVE';
    const q = query.get('q')?.toLowerCase();
    const matches = this.directory.filter(
      (person) =>
        (!query.get('personType') || person.personType === query.get('personType')) &&
        (status === 'ALL' || person.status === status) &&
        (!query.get('departmentCode') ||
          (person.department as { code?: string } | null)?.code === query.get('departmentCode')) &&
        (!query.get('entryYear') || String(person.entryYear) === query.get('entryYear')) &&
        (!q || `${String(person.personCode)} ${String(person.fullNameTh)}`.toLowerCase().includes(q)),
    );
    send(200, {
      success: true,
      data: matches.slice((page - 1) * limit, page * limit),
      meta: { total: matches.length, page, limit, totalPages: Math.max(1, Math.ceil(matches.length / limit)) },
    });
  }

  /** GET /api/v1/departments - paged reference data, open ones only. */
  private serveDepartments(req: IncomingMessage, res: ServerResponse): void {
    this.serveReference(req, res, this.departments);
  }

  /** Any reference dataset: paged, open rows only unless includeInactive=true. */
  private serveReference(
    req: IncomingMessage,
    res: ServerResponse,
    rows: Array<Record<string, unknown> & { isActive: boolean }>,
  ): void {
    const query = new URL(req.url ?? '/', 'http://core-hub.test').searchParams;
    const page = Number(query.get('page') ?? '1');
    const limit = Number(query.get('limit') ?? '20');
    const items =
      query.get('includeInactive') === 'true' ? rows : rows.filter((row) => row.isActive);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        success: true,
        data: items.slice((page - 1) * limit, page * limit),
        meta: { total: items.length, page, limit, totalPages: Math.max(1, Math.ceil(items.length / limit)) },
      }),
    );
  }

  /** Core Hub's error envelope - every 5xx carries INTERNAL_ERROR, so status is what counts. */
  private fail(res: ServerResponse, failure: CoreHubFailure): void {
    res.writeHead(failure.status, {
      'content-type': 'application/json',
      ...(failure.retryAfter !== undefined ? { 'retry-after': failure.retryAfter } : {}),
    });
    res.end(
      JSON.stringify({
        success: false,
        error: { code: failure.status >= 500 ? 'INTERNAL_ERROR' : 'ERROR', message: 'fake failure' },
      }),
    );
  }

  get port(): number {
    return (this.server!.address() as AddressInfo).port;
  }

  get url(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  get jwksUrl(): string {
    return `${this.url}/api/v1/.well-known/jwks.json`;
  }

  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve, reject) =>
        this.server!.close((error) => (error ? reject(error) : resolve())),
      );
      this.server = undefined;
    }
  }
}
