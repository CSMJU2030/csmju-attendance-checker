-- Class sections now point at a Core Hub course (course_code = its full code).
-- The name is read from Core Hub when shown and is no longer stored; only
-- sections made before the link keep the name that was typed.

-- AlterTable
ALTER TABLE "class_sections" ALTER COLUMN "course_name" DROP NOT NULL;
