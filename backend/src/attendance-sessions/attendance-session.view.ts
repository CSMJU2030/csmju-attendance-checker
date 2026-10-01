import { AttendanceSession } from '../../generated/prisma/client';

/** Public shape of a session. `codeSecret` never leaves the backend. */
export interface AttendanceSessionView {
  id: string;
  classSectionId: string;
  openedByCoreUserId: string;
  status: AttendanceSession['status'];
  openedAt: Date;
  closedAt: Date | null;
  /** Students who checked in to this session. */
  recordCount: number;
  /** Of those, how many were LATE. */
  lateCount: number;
}

export interface SessionCounts {
  recordCount: number;
  lateCount: number;
}

export const NO_COUNTS: SessionCounts = { recordCount: 0, lateCount: 0 };

export function toSessionView(
  session: AttendanceSession,
  counts: SessionCounts = NO_COUNTS,
): AttendanceSessionView {
  return {
    id: session.id,
    classSectionId: session.classSectionId,
    openedByCoreUserId: session.openedByCoreUserId,
    status: session.status,
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    recordCount: counts.recordCount,
    lateCount: counts.lateCount,
  };
}
