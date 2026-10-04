/** field ที่ทุกชุดข้อมูลอ้างอิงต้องมี (สเปกข้อ 4.1) — ไม่มี id */
export interface ReferenceItem {
  code: string;
  isActive: boolean;
  updatedAt: string;
}

export interface Faculty extends ReferenceItem {
  nameTh: string;
  nameEn: string;
}

export interface Department extends ReferenceItem {
  nameTh: string;
  nameEn: string | null;
  facultyCode: string;
}

/** `code` is the full code with its version, e.g. 10301111-1 (reference-data.md 4.6). */
export interface Course extends ReferenceItem {
  baseCode: string;
  nameTh: string;
  nameEn: string | null;
  credits: number;
  departmentCode: string | null;
}

export type RoomType = 'LECTURE' | 'LAB' | 'SEMINAR' | 'MEETING' | 'PROJECT' | 'OFFICE';

export interface Room extends ReferenceItem {
  nameTh: string;
  /** ชื่ออาคาร (สำหรับแสดงผล) */
  building: string;
  /** รหัสอาคาร — ใช้อ้างอิง */
  buildingCode: string;
  floor: number | null;
  capacity: number | null;
  roomType: RoomType;
  facultyCode: string | null;
  photoUrl: string | null;
}

export interface AcademicTerm extends ReferenceItem {
  /** "<ปี พ.ศ.>-<ภาค>" เช่น 2569-1 */
  academicYear: number;
  semester: number;
  /** YYYY-MM-DD */
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}
