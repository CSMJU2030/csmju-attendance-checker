-- Replace the demo-student-subsystem domain (students, courses, enrollments)
-- with the Attendance Checker domain. The demo tables hold only demo seed data.

-- CreateEnum
CREATE TYPE "AttendanceSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE');

-- DropForeignKey
ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_student_id_fkey";

-- DropForeignKey
ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_course_id_fkey";

-- DropTable
DROP TABLE "students";

-- DropTable
DROP TABLE "courses";

-- DropTable
DROP TABLE "enrollments";

-- DropEnum
DROP TYPE "EnrollmentStatus";

-- CreateTable
CREATE TABLE "class_sections" (
    "id" TEXT NOT NULL,
    "course_code" TEXT NOT NULL,
    "course_name" TEXT NOT NULL,
    "section_code" TEXT NOT NULL,
    "academic_year" INTEGER NOT NULL,
    "term" INTEGER NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radius_meters" INTEGER NOT NULL DEFAULT 50,
    "late_after_minutes" INTEGER NOT NULL DEFAULT 15,
    "owner_core_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_sessions" (
    "id" TEXT NOT NULL,
    "class_section_id" TEXT NOT NULL,
    "opened_by_core_user_id" TEXT NOT NULL,
    "status" "AttendanceSessionStatus" NOT NULL DEFAULT 'OPEN',
    "code_secret" TEXT NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "attendance_session_id" TEXT NOT NULL,
    "core_user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "checked_in_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "distance_meters" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "class_sections_owner_core_user_id_idx" ON "class_sections"("owner_core_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_sections_course_code_section_code_academic_year_term_key" ON "class_sections"("course_code", "section_code", "academic_year", "term");

-- CreateIndex
CREATE INDEX "attendance_sessions_class_section_id_status_idx" ON "attendance_sessions"("class_section_id", "status");

-- CreateIndex
CREATE INDEX "attendance_sessions_status_idx" ON "attendance_sessions"("status");

-- CreateIndex
CREATE INDEX "attendance_records_core_user_id_idx" ON "attendance_records"("core_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_attendance_session_id_core_user_id_key" ON "attendance_records"("attendance_session_id", "core_user_id");

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_class_section_id_fkey" FOREIGN KEY ("class_section_id") REFERENCES "class_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_attendance_session_id_fkey" FOREIGN KEY ("attendance_session_id") REFERENCES "attendance_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
