"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  CrosshairIcon,
  DescriptionList,
  FormField,
  Select,
  TextInput,
  fieldA11y,
  formatTerm,
  toBuddhistYear,
  toGregorianYear,
} from "@csmju2030/design-system";
import { apiRequest } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import type { ClassSection, ClassSectionInput } from "@/lib/types";

type FieldName =
  | "courseCode"
  | "courseName"
  | "sectionCode"
  | "academicYear"
  | "term"
  | "latitude"
  | "longitude"
  | "radiusMeters"
  | "lateAfterMinutes";

type Values = Record<FieldName, string>;
type Errors = Partial<Record<FieldName, string>>;

const FIELD_ORDER: FieldName[] = [
  "courseCode",
  "courseName",
  "sectionCode",
  "academicYear",
  "term",
  "latitude",
  "longitude",
  "radiusMeters",
  "lateAfterMinutes",
];

/** Course code, section, year and term identify a section and cannot change. */
const IDENTITY_FIELDS: FieldName[] = ["courseCode", "sectionCode", "academicYear", "term"];

function isNumberIn(value: string, min: number, max: number, integer = false): boolean {
  if (value.trim() === "") {
    return false;
  }
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max && (!integer || Number.isInteger(number));
}

function validateField(name: FieldName, value: string): string | undefined {
  switch (name) {
    case "courseCode":
      return /^[A-Z]{2,4}\d{3,4}$/.test(value)
        ? undefined
        : "รหัสวิชาต้องเป็นอักษรภาษาอังกฤษ 2–4 ตัว ตามด้วยตัวเลข 3–4 หลัก เช่น CS201";
    case "courseName":
      return value.trim().length >= 1 && value.trim().length <= 200 ? undefined : "กรอกชื่อวิชา (ไม่เกิน 200 ตัวอักษร)";
    case "sectionCode":
      return /^\d{1,3}$/.test(value) ? undefined : "กลุ่มเรียนต้องเป็นตัวเลข 1–3 หลัก เช่น 1";
    case "academicYear":
      return isNumberIn(value, 2543, 2643, true) ? undefined : "กรอกปีการศึกษาเป็น พ.ศ. เช่น 2569";
    case "term":
      return isNumberIn(value, 1, 3, true) ? undefined : "เลือกภาคเรียน";
    case "latitude":
      return isNumberIn(value, -90, 90) ? undefined : "ละติจูดต้องเป็นตัวเลขระหว่าง -90 ถึง 90";
    case "longitude":
      return isNumberIn(value, -180, 180) ? undefined : "ลองจิจูดต้องเป็นตัวเลขระหว่าง -180 ถึง 180";
    case "radiusMeters":
      return isNumberIn(value, 10, 500, true) ? undefined : "รัศมีต้องเป็นจำนวนเต็ม 10–500 เมตร";
    case "lateAfterMinutes":
      return isNumberIn(value, 0, 180, true) ? undefined : "ต้องเป็นจำนวนเต็ม 0–180 นาที";
  }
}

function initialValues(section?: ClassSection): Values {
  if (section) {
    return {
      courseCode: section.courseCode,
      courseName: section.courseName,
      sectionCode: section.sectionCode,
      academicYear: String(toBuddhistYear(section.academicYear)),
      term: String(section.term),
      latitude: String(section.latitude),
      longitude: String(section.longitude),
      radiusMeters: String(section.radiusMeters),
      lateAfterMinutes: String(section.lateAfterMinutes),
    };
  }
  const year = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric" }).format(new Date()));
  return {
    courseCode: "",
    courseName: "",
    sectionCode: "1",
    academicYear: String(toBuddhistYear(year)),
    term: "1",
    latitude: "",
    longitude: "",
    radiusMeters: "50",
    lateAfterMinutes: "15",
  };
}

export function ClassSectionForm({ section }: { section?: ClassSection }) {
  const router = useRouter();
  const editing = section !== undefined;
  const [values, setValues] = useState<Values>(() => initialValues(section));
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const refs = useRef<Partial<Record<FieldName, HTMLInputElement | HTMLSelectElement | null>>>({});

  const fields = editing ? FIELD_ORDER.filter((name) => !IDENTITY_FIELDS.includes(name)) : FIELD_ORDER;

  function set(name: FieldName, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    if (errors[name]) {
      setErrors((current) => ({ ...current, [name]: validateField(name, value) }));
    }
  }

  function blur(name: FieldName) {
    setErrors((current) => ({ ...current, [name]: validateField(name, values[name]) }));
  }

  function fillMyLocation() {
    setLocationNote(null);
    if (!("geolocation" in navigator) || !window.isSecureContext) {
      setLocationNote("อุปกรณ์นี้ระบุตำแหน่งไม่ได้ กรุณากรอกละติจูดและลองจิจูดเอง");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        set("latitude", position.coords.latitude.toFixed(6));
        set("longitude", position.coords.longitude.toFixed(6));
        setErrors((current) => ({ ...current, latitude: undefined, longitude: undefined }));
        setLocationNote(`ได้ตำแหน่งแล้ว คลาดเคลื่อนประมาณ ${Math.round(position.coords.accuracy)} เมตร`);
      },
      () => {
        setLocating(false);
        setLocationNote("หาตำแหน่งไม่สำเร็จ กรุณาอนุญาตการเข้าถึงตำแหน่ง หรือกรอกละติจูดและลองจิจูดเอง");
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const nextErrors: Errors = {};
    for (const name of fields) {
      nextErrors[name] = validateField(name, values[name]);
    }
    setErrors(nextErrors);
    const invalid = fields.filter((name) => nextErrors[name]);
    if (invalid.length > 0) {
      setAnnounce(`มีข้อมูลที่ต้องแก้ไข ${invalid.length} ช่อง`);
      refs.current[invalid[0]]?.focus();
      return;
    }
    setAnnounce("");

    const editable = {
      courseName: values.courseName.trim(),
      latitude: Number(values.latitude),
      longitude: Number(values.longitude),
      radiusMeters: Number(values.radiusMeters),
      lateAfterMinutes: Number(values.lateAfterMinutes),
    };
    const body: Partial<ClassSectionInput> = editing
      ? editable
      : {
          ...editable,
          courseCode: values.courseCode,
          sectionCode: values.sectionCode,
          academicYear: toGregorianYear(Number(values.academicYear)),
          term: Number(values.term),
        };

    setSaving(true);
    const result = editing
      ? await apiRequest<ClassSection>("PATCH", `/api/v1/class-sections/${section.id}`, body)
      : await apiRequest<ClassSection>("POST", "/api/v1/class-sections", body);
    setSaving(false);

    if (result.ok) {
      router.push(`/class-sections/${result.data.id}?saved=1`);
      router.refresh();
      return;
    }
    if (result.status !== 401) {
      setFormError(errorMessage(result.error));
      window.scrollTo({ top: 0 });
    }
  }

  const input = (name: FieldName, props: { inputMode?: "decimal" | "numeric" | "text"; hint?: string; required?: boolean } = {}) => ({
    ...fieldA11y(name, { error: errors[name], hint: props.hint, required: props.required ?? true }),
    name,
    ref: (element: HTMLInputElement | null) => {
      refs.current[name] = element;
    },
    value: values[name],
    inputMode: props.inputMode,
    onBlur: () => blur(name),
  });

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        <p className="text-sm text-muted">ช่องที่มี * จำเป็นต้องกรอก</p>
        <div aria-live="assertive" className="sr-only">
          {announce}
        </div>
        {formError ? <Alert tone="danger" title="บันทึกไม่สำเร็จ">{formError}</Alert> : null}

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-2 font-heading text-lg font-semibold text-ink">รายวิชา</legend>
          {editing ? (
            <DescriptionList
              items={[
                { term: "รหัสวิชา", value: <span className="font-mono">{section.courseCode}</span> },
                { term: "กลุ่มเรียน", value: section.sectionCode },
                { term: "ภาคเรียน", value: formatTerm(section.term, section.academicYear) },
              ]}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <FormField id="courseCode" label="รหัสวิชา" required hint="เช่น CS201" error={errors.courseCode}>
                <TextInput
                  {...input("courseCode", { hint: "เช่น CS201" })}
                  autoCapitalize="characters"
                  onChange={(event) => set("courseCode", event.target.value.toUpperCase().replace(/\s/g, ""))}
                />
              </FormField>
              <FormField id="sectionCode" label="กลุ่มเรียน" required hint="ตัวเลข เช่น 1" error={errors.sectionCode}>
                <TextInput
                  {...input("sectionCode", { inputMode: "numeric", hint: "ตัวเลข เช่น 1" })}
                  onChange={(event) => set("sectionCode", event.target.value.replace(/\D/g, ""))}
                />
              </FormField>
            </div>
          )}

          <FormField id="courseName" label="ชื่อวิชา" required error={errors.courseName}>
            <TextInput {...input("courseName")} onChange={(event) => set("courseName", event.target.value)} />
          </FormField>

          {editing ? null : (
            <div className="grid gap-4 md:grid-cols-2">
              <FormField id="academicYear" label="ปีการศึกษา (พ.ศ.)" required hint="เช่น 2569" error={errors.academicYear}>
                <TextInput
                  {...input("academicYear", { inputMode: "numeric", hint: "เช่น 2569" })}
                  onChange={(event) => set("academicYear", event.target.value.replace(/\D/g, "").slice(0, 4))}
                />
              </FormField>
              <FormField id="term" label="ภาคเรียน" required error={errors.term}>
                <Select
                  {...fieldA11y("term", { error: errors.term, required: true })}
                  name="term"
                  ref={(element) => {
                    refs.current.term = element;
                  }}
                  value={values.term}
                  onChange={(event) => set("term", event.target.value)}
                >
                  <option value="1">ภาคเรียนที่ 1</option>
                  <option value="2">ภาคเรียนที่ 2</option>
                  <option value="3">ภาคฤดูร้อน</option>
                </Select>
              </FormField>
            </div>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-2 font-heading text-lg font-semibold text-ink">จุดเช็คชื่อ</legend>
          <p className="text-sm text-muted">
            ยืนอยู่ในห้องเรียนแล้วกดใช้ตำแหน่งปัจจุบัน นักศึกษาต้องอยู่ภายในรัศมีจากจุดนี้จึงจะเช็คชื่อได้
          </p>
          <div>
            <Button variant="secondary" onClick={fillMyLocation} loading={locating}>
              <CrosshairIcon size={16} />
              ใช้ตำแหน่งปัจจุบันของฉัน
            </Button>
          </div>
          {locationNote ? (
            <p aria-live="polite" className="text-sm text-body">
              {locationNote}
            </p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <FormField id="latitude" label="ละติจูด" required error={errors.latitude}>
              <TextInput {...input("latitude", { inputMode: "decimal" })} onChange={(event) => set("latitude", event.target.value)} />
            </FormField>
            <FormField id="longitude" label="ลองจิจูด" required error={errors.longitude}>
              <TextInput {...input("longitude", { inputMode: "decimal" })} onChange={(event) => set("longitude", event.target.value)} />
            </FormField>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField id="radiusMeters" label="รัศมีเช็คชื่อ (เมตร)" required hint="10–500 เมตร ค่าแนะนำ 50" error={errors.radiusMeters}>
              <TextInput
                {...input("radiusMeters", { inputMode: "numeric", hint: "10–500 เมตร ค่าแนะนำ 50" })}
                onChange={(event) => set("radiusMeters", event.target.value.replace(/\D/g, ""))}
              />
            </FormField>
            <FormField
              id="lateAfterMinutes"
              label="นับว่าสายหลังเปิดรอบ (นาที)"
              required
              hint="เช็คชื่อหลังจากนี้จะถูกบันทึกว่ามาสาย"
              error={errors.lateAfterMinutes}
            >
              <TextInput
                {...input("lateAfterMinutes", { inputMode: "numeric", hint: "เช็คชื่อหลังจากนี้จะถูกบันทึกว่ามาสาย" })}
                onChange={(event) => set("lateAfterMinutes", event.target.value.replace(/\D/g, ""))}
              />
            </FormField>
          </div>
        </fieldset>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" loading={saving}>
            {editing ? "บันทึกการเปลี่ยนแปลง" : "บันทึกกลุ่มเรียน"}
          </Button>
          <ButtonLink href={editing ? `/class-sections/${section.id}` : "/class-sections"} variant="ghost">
            ยกเลิก
          </ButtonLink>
        </div>
      </form>
    </Card>
  );
}
