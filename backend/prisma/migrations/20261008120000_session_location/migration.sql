-- A session may keep the point the lecturer stood on when opening it.
-- Students are measured from that point; sessions without one (all older
-- sessions) keep using the class section's saved point.

-- AlterTable
ALTER TABLE "attendance_sessions" ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION;
