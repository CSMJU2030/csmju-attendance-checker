-- Attendance no longer has a "late" status: the lecturer decides the
-- check-in window by opening and closing the session, a record means the
-- student attended, and a closed session without one counts as absent.

-- AlterTable
ALTER TABLE "attendance_records" DROP COLUMN "status";

-- AlterTable
ALTER TABLE "class_sections" DROP COLUMN "late_after_minutes";

-- DropEnum
DROP TYPE "AttendanceStatus";
