-- Align column names with the CSMJU2030 Subsystem Standard: PostgreSQL columns
-- are snake_case (Prisma field names stay camelCase through @map).
--
-- RENAME is used instead of drop/add so existing rows are preserved.

-- students -------------------------------------------------------------------
ALTER TABLE "students" RENAME COLUMN "coreUserId"  TO "core_user_id";
ALTER TABLE "students" RENAME COLUMN "studentCode" TO "student_code";
ALTER TABLE "students" RENAME COLUMN "firstName"   TO "first_name";
ALTER TABLE "students" RENAME COLUMN "lastName"    TO "last_name";
ALTER TABLE "students" RENAME COLUMN "createdAt"   TO "created_at";
ALTER TABLE "students" RENAME COLUMN "updatedAt"   TO "updated_at";

ALTER INDEX "students_coreUserId_key"  RENAME TO "students_core_user_id_key";
ALTER INDEX "students_studentCode_key" RENAME TO "students_student_code_key";

-- courses --------------------------------------------------------------------
ALTER TABLE "courses" RENAME COLUMN "courseCode" TO "course_code";
ALTER TABLE "courses" RENAME COLUMN "createdAt"  TO "created_at";
ALTER TABLE "courses" RENAME COLUMN "updatedAt"  TO "updated_at";

ALTER INDEX "courses_courseCode_key" RENAME TO "courses_course_code_key";

-- enrollments ----------------------------------------------------------------
ALTER TABLE "enrollments" RENAME COLUMN "studentId"  TO "student_id";
ALTER TABLE "enrollments" RENAME COLUMN "courseId"   TO "course_id";
ALTER TABLE "enrollments" RENAME COLUMN "enrolledAt" TO "enrolled_at";
ALTER TABLE "enrollments" RENAME COLUMN "createdAt"  TO "created_at";
ALTER TABLE "enrollments" RENAME COLUMN "updatedAt"  TO "updated_at";

ALTER INDEX "enrollments_studentId_status_idx"    RENAME TO "enrollments_student_id_status_idx";
ALTER INDEX "enrollments_courseId_status_idx"     RENAME TO "enrollments_course_id_status_idx";
ALTER INDEX "enrollments_studentId_courseId_key"  RENAME TO "enrollments_student_id_course_id_key";

ALTER TABLE "enrollments" RENAME CONSTRAINT "enrollments_studentId_fkey" TO "enrollments_student_id_fkey";
ALTER TABLE "enrollments" RENAME CONSTRAINT "enrollments_courseId_fkey"  TO "enrollments_course_id_fkey";
