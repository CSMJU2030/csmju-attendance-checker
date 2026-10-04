import { Injectable, Logger } from '@nestjs/common';
import { AppException, ErrorCode } from '../common/errors';
import { Course } from './reference-data.types';
import { ReferenceDataService } from './reference-data.service';

export interface CourseName {
  nameTh: string;
  isActive: boolean;
}

/**
 * Courses are Core Hub reference data (reference-data.md 4.6): a class
 * section keeps only the full course `code`, and the name is read from the
 * shared 10-minute cache whenever a section is shown - never copied into the
 * database (reference-data.md 8).
 *
 * Showing must never break: when Core Hub is down and nothing is cached, the
 * lookups below answer "unknown" and the screen falls back to the code.
 */
@Injectable()
export class CourseCatalog {
  private readonly logger = new Logger(CourseCatalog.name);

  constructor(private readonly reference: ReferenceDataService) {}

  /** Names of the given course codes, including closed courses; unknown codes are left out. */
  async names(codes: string[], token: string): Promise<Map<string, CourseName>> {
    const wanted = new Set(codes);
    const found = new Map<string, CourseName>();
    if (wanted.size === 0) {
      return found;
    }
    const all = await this.everything(token);
    for (const course of all) {
      if (wanted.has(course.code)) {
        found.set(course.code, { nameTh: course.nameTh, isActive: course.isActive });
      }
    }
    return found;
  }

  /** Open courses whose code or name contains `q`, sorted by code. */
  async search(q: string, token: string, limit: number): Promise<Course[]> {
    const needle = q.trim().toLowerCase();
    const open = await this.reference.list<Course>('courses', token);
    return open
      .filter(
        (course) =>
          !needle ||
          course.code.toLowerCase().includes(needle) ||
          course.nameTh.toLowerCase().includes(needle) ||
          (course.nameEn ?? '').toLowerCase().includes(needle),
      )
      .sort((a, b) => a.code.localeCompare(b.code))
      .slice(0, limit);
  }

  /** Codes of courses whose name contains `q` - lets a section search match by course name. */
  async codesNamed(q: string, token: string): Promise<string[]> {
    const needle = q.trim().toLowerCase();
    const all = await this.everything(token);
    return all
      .filter(
        (course) =>
          course.nameTh.toLowerCase().includes(needle) ||
          (course.nameEn ?? '').toLowerCase().includes(needle),
      )
      .map((course) => course.code);
  }

  /** Taking data in: the code must exist in Core Hub and be open (400 otherwise). */
  async assertOpen(code: string, token: string): Promise<void> {
    const course = await this.reference.get<Course>('courses', code, token);
    if (!course || !course.isActive) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        `ไม่พบรายวิชารหัส ${code} ใน Core Hub หรือรายวิชานี้ปิดแล้ว`,
        400,
        ['courseCode must be an open Core Hub course code'],
      );
    }
  }

  /** Every course, open or closed - or none when Core Hub cannot be reached. */
  private async everything(token: string): Promise<Course[]> {
    try {
      return await this.reference.all<Course>('courses', token);
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'course_catalog.unavailable',
          reason: error instanceof Error ? error.message : 'unknown',
        }),
      );
      return [];
    }
  }
}
