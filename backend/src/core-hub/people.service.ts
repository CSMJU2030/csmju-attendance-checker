import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CoreHubCallError, coreHubFailure, getFromCoreHub } from './core-hub-http';

/**
 * ข้อมูลบุคคลจาก Core Hub (reference-data.md ข้อ 5) — ไม่ใช่ข้อมูลอ้างอิง
 *
 * - **ห้าม cache ทุกแบบ** แม้แยกรายคน: เรียกตอนใช้ด้วย token ของผู้ใช้คนนั้นทุกครั้ง
 * - ระบบนี้เก็บได้แค่ `person_code` ตอนเกิดรายการ (ข้อ 8) — ไม่เก็บชื่อ อีเมล หรือ field อื่น
 *   คำตอบของ /people/me มีชื่อและอีเมล จึงไม่ log และไม่ส่งต่อทั้งก้อน
 */
@Injectable()
export class PeopleService {
  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return this.config.get<string>('coreHub.url', 'http://localhost:3000').replace(/\/+$/, '');
  }

  private get requestTimeoutMs(): number {
    return this.config.get<number>('coreHub.dataRequestTimeoutMs', 5_000);
  }

  /**
   * `personCode` ของผู้เรียก จาก `GET /people/me` — รหัสนักศึกษา หรือส่วนหน้าอีเมลของบุคลากร
   *
   * - บัญชียังไม่ผูกกับบุคคล (`data: null` เช่น บัญชีทดสอบ) → null
   * - role ที่อ่านไม่ได้ (`guest` ได้ 403) → null
   * - Core Hub ตอบ 401 → 401 UNAUTHORIZED ให้ frontend พา SSO ใหม่
   * - 429 → 503 + Retry-After ของ Core Hub · ล่ม/timeout/คำตอบผิดรูปแบบ → 503 + Retry-After 30
   */
  async myPersonCode(token: string): Promise<string | null> {
    let body: unknown;
    try {
      body = await getFromCoreHub(`${this.baseUrl}/api/v1/people/me`, token, this.requestTimeoutMs);
    } catch (error) {
      if (error instanceof CoreHubCallError && error.status === 403) {
        return null;
      }
      throw coreHubFailure(error);
    }

    const { success, data } = (body ?? {}) as { success?: unknown; data?: unknown };
    if (success === true && data === null) {
      return null;
    }
    const personCode = (data as { personCode?: unknown } | undefined)?.personCode;
    if (success !== true || typeof personCode !== 'string' || personCode.length === 0) {
      throw coreHubFailure(new Error('GET /people/me answered without a personCode'));
    }
    return personCode;
  }

  /**
   * Active students from `GET /people` - one Core Hub call per page of up to
   * 100, never one call per person (reference-data.md 7.2). Needs a token
   * with `people:read` (staff, lecturer, admin). Only the fields the roster
   * screen shows are passed on; nothing is cached or stored.
   */
  async searchStudents(token: string, filter: StudentSearch): Promise<StudentPage> {
    const query = new URLSearchParams({
      personType: 'STUDENT',
      status: 'ACTIVE',
      page: String(filter.page),
      limit: String(filter.limit),
    });
    if (filter.departmentCode) query.set('departmentCode', filter.departmentCode);
    if (filter.entryYear !== undefined) query.set('entryYear', String(filter.entryYear));
    if (filter.q) query.set('q', filter.q);

    let body: unknown;
    try {
      body = await getFromCoreHub(`${this.baseUrl}/api/v1/people?${query}`, token, this.requestTimeoutMs);
    } catch (error) {
      throw coreHubFailure(error);
    }

    const { success, data, meta } = (body ?? {}) as { success?: unknown; data?: unknown; meta?: unknown };
    if (success !== true || !Array.isArray(data)) {
      throw coreHubFailure(new Error('GET /people answered without a list'));
    }
    const items = data.flatMap((raw): StudentSummary[] => {
      const person = raw as Record<string, unknown>;
      if (typeof person.personCode !== 'string') return [];
      const department = person.department as { code?: unknown; nameTh?: unknown } | null | undefined;
      return [
        {
          personCode: person.personCode,
          fullNameTh: typeof person.fullNameTh === 'string' ? person.fullNameTh : '',
          entryYear: typeof person.entryYear === 'number' ? person.entryYear : null,
          departmentCode: typeof department?.code === 'string' ? department.code : null,
          departmentNameTh: typeof department?.nameTh === 'string' ? department.nameTh : null,
        },
      ];
    });
    const total = Number((meta as { total?: unknown } | undefined)?.total);
    return { items, total: Number.isFinite(total) ? total : items.length };
  }
}

export interface StudentSearch {
  departmentCode?: string;
  /** Buddhist-era year the student entered. */
  entryYear?: number;
  q?: string;
  page: number;
  limit: number;
}

export interface StudentSummary {
  personCode: string;
  fullNameTh: string;
  entryYear: number | null;
  departmentCode: string | null;
  departmentNameTh: string | null;
}

export interface StudentPage {
  items: StudentSummary[];
  total: number;
}
