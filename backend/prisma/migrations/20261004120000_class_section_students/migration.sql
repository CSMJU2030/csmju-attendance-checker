-- Roster of a class section: Core Hub has no enrollment data, so lecturers
-- list the students of each section here. Only the student id is kept.

-- CreateTable
CREATE TABLE "class_section_students" (
    "id" TEXT NOT NULL,
    "class_section_id" TEXT NOT NULL,
    "person_code" TEXT NOT NULL,
    "added_by_core_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_section_students_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "class_section_students_person_code_idx" ON "class_section_students"("person_code");

-- CreateIndex
CREATE UNIQUE INDEX "class_section_students_class_section_id_person_code_key" ON "class_section_students"("class_section_id", "person_code");

-- AddForeignKey
ALTER TABLE "class_section_students" ADD CONSTRAINT "class_section_students_class_section_id_fkey" FOREIGN KEY ("class_section_id") REFERENCES "class_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
