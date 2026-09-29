import { AttendanceSession } from '../../generated/prisma/client';

/** Public shape of a session. `codeSecret` never leaves the backend. */
export interface AttendanceSessionView {
  id: string;
  classSectionId: string;
  openedByCoreUserId: string;
  status: AttendanceSession['status'];
  openedAt: Date;
  closedAt: Date | null;
}

export function toSessionView(session: AttendanceSession): AttendanceSessionView {
  return {
    id: session.id,
    classSectionId: session.classSectionId,
    openedByCoreUserId: session.openedByCoreUserId,
    status: session.status,
    openedAt: session.openedAt,
    closedAt: session.closedAt,
  };
}
