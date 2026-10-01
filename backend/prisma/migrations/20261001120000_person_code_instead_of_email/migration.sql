-- standards 1.7.0 (reference-data.md 8): a subsystem stores ids only - no names or e-mail
-- addresses. The student is now identified by `core_user_id` plus `person_code` from
-- Core Hub's GET /people/me. Existing e-mail values are dropped on purpose; rows
-- recorded before this migration keep `core_user_id` and get no `person_code`.

-- AlterTable
ALTER TABLE "attendance_records" ADD COLUMN "person_code" TEXT;
ALTER TABLE "attendance_records" DROP COLUMN "email";
