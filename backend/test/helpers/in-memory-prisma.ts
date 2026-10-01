/**
 * An in-memory stand-in for PrismaService so the e2e suite can exercise the
 * real HTTP stack (guards, pipes, filters, controllers, services) without a
 * PostgreSQL instance. It supports only the query shapes this codebase uses.
 */
import { randomUUID } from 'crypto';
import { Prisma } from '../../generated/prisma/client';

type Row = Record<string, any>;

function uniqueViolation(target: string[]): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'in-memory',
    meta: { target },
  });
}

function matches(row: Row, where: Row | undefined): boolean {
  if (!where) {
    return true;
  }

  return Object.entries(where).every(([field, condition]) => {
    if (condition === undefined) {
      return true;
    }
    if (field === 'OR') {
      return (condition as Row[]).some((clause) => matches(row, clause));
    }
    if (field === 'AND') {
      return (condition as Row[]).every((clause) => matches(row, clause));
    }
    if (condition && typeof condition === 'object' && 'in' in condition) {
      return ((condition as Row).in as unknown[]).includes(row[field]);
    }
    if (condition && typeof condition === 'object' && 'contains' in condition) {
      const haystack = String(row[field] ?? '');
      const needle = String((condition as Row).contains);
      return (condition as Row).mode === 'insensitive'
        ? haystack.toLowerCase().includes(needle.toLowerCase())
        : haystack.includes(needle);
    }
    return row[field] === condition;
  });
}

function sortRows(rows: Row[], orderBy?: Row): Row[] {
  if (!orderBy) {
    return rows;
  }
  const [field, direction] = Object.entries(orderBy)[0] as [string, 'asc' | 'desc'];
  return [...rows].sort((a, b) => {
    const left = a[field];
    const right = b[field];
    if (left === right) return 0;
    const result = left > right ? 1 : -1;
    return direction === 'desc' ? -result : result;
  });
}

class Table {
  rows: Row[] = [];

  constructor(
    private readonly uniqueFields: string[],
    private readonly compositeUnique: string[][] = [],
    private readonly defaults: () => Row = () => ({}),
  ) {}

  private findByWhere(where: Row): Row | undefined {
    // Composite unique key, e.g. { attendanceSessionId_coreUserId: { ... } }
    for (const fields of this.compositeUnique) {
      const key = fields.join('_');
      if (where[key]) {
        return this.rows.find((row) => fields.every((field) => row[field] === where[key][field]));
      }
    }
    return this.rows.find((row) =>
      Object.entries(where).every(([field, value]) => row[field] === value),
    );
  }

  async findUnique({ where }: { where: Row; include?: Row }): Promise<Row | null> {
    return this.findByWhere(where) ?? null;
  }

  async findUniqueOrThrow(args: { where: Row }): Promise<Row> {
    const row = await this.findUnique(args);
    if (!row) {
      throw new Prisma.PrismaClientKnownRequestError('Not found', {
        code: 'P2025',
        clientVersion: 'in-memory',
      });
    }
    return row;
  }

  async findMany(args: { where?: Row; orderBy?: Row; skip?: number; take?: number } = {}): Promise<Row[]> {
    const filtered = this.rows.filter((row) => matches(row, args.where));
    const sorted = sortRows(filtered, args.orderBy);
    const start = args.skip ?? 0;
    return sorted.slice(start, args.take === undefined ? undefined : start + args.take);
  }

  /** `groupBy({ by, where, _count: { _all: true } })` - the only shape this codebase uses. */
  async groupBy({ by, where }: { by: string[]; where?: Row; _count?: Row }): Promise<Row[]> {
    const groups = new Map<string, Row>();
    for (const row of this.rows.filter((candidate) => matches(candidate, where))) {
      const key = JSON.stringify(by.map((field) => row[field]));
      const group = groups.get(key) ?? {
        ...Object.fromEntries(by.map((field) => [field, row[field]])),
        _count: { _all: 0 },
      };
      group._count._all += 1;
      groups.set(key, group);
    }
    return [...groups.values()];
  }

  async count({ where }: { where?: Row } = {}): Promise<number> {
    return this.rows.filter((row) => matches(row, where)).length;
  }

  async create({ data }: { data: Row; include?: Row }): Promise<Row> {
    for (const field of this.uniqueFields) {
      if (data[field] !== undefined && data[field] !== null) {
        if (this.rows.some((row) => row[field] === data[field])) {
          throw uniqueViolation([field]);
        }
      }
    }
    for (const fields of this.compositeUnique) {
      if (this.rows.some((row) => fields.every((field) => row[field] === data[field]))) {
        throw uniqueViolation(fields);
      }
    }

    const now = new Date();
    const row = { id: randomUUID(), ...this.defaults(), ...data, createdAt: now, updatedAt: now };
    this.rows.push(row);
    return row;
  }

  async update({ where, data }: { where: Row; data: Row; include?: Row }): Promise<Row> {
    const row = this.findByWhere(where);
    if (!row) {
      throw new Prisma.PrismaClientKnownRequestError('Not found', {
        code: 'P2025',
        clientVersion: 'in-memory',
      });
    }
    Object.assign(row, data, { updatedAt: new Date() });
    return row;
  }

  async delete({ where }: { where: Row }): Promise<Row> {
    const row = this.findByWhere(where);
    if (!row) {
      throw new Prisma.PrismaClientKnownRequestError('Not found', {
        code: 'P2025',
        clientVersion: 'in-memory',
      });
    }
    this.rows = this.rows.filter((candidate) => candidate !== row);
    return row;
  }
}

export class InMemoryPrisma {
  classSection = new Table(
    [],
    [['courseCode', 'sectionCode', 'academicYear', 'term']],
    () => ({ radiusMeters: 50, lateAfterMinutes: 15 }),
  );
  attendanceSession = new Table([], [], () => ({
    status: 'OPEN',
    openedAt: new Date(),
    closedAt: null,
  }));
  attendanceRecord = new Table([], [['attendanceSessionId', 'coreUserId']], () => ({
    checkedInAt: new Date(),
  }));

  async $connect(): Promise<void> {}
  async $disconnect(): Promise<void> {}
  async onModuleInit(): Promise<void> {}
  async onModuleDestroy(): Promise<void> {}

  reset(): void {
    this.classSection.rows = [];
    this.attendanceSession.rows = [];
    this.attendanceRecord.rows = [];
  }
}
