"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  BookOpenIcon,
  CrosshairIcon,
  DescriptionList,
  FormField,
  MapPinIcon,
  Select,
  TextInput,
  fieldA11y,
  formatTerm,
  toBuddhistYear,
} from "@/components/shared/kit";
import { apiRequest } from "@/lib/api-client";
import {
  IDENTITY_FIELDS,
  FIELD_ORDER,
  toRequestBody,
  validateField,
  type Errors,
  type FieldName,
  type Values,
} from "@/lib/class-section-validation";
import { errorMessage } from "@/lib/errors";
import type { ClassSection, CourseSummary } from "@/lib/types";
import { CoursePicker } from "./course-picker";

function initialValues(section?: ClassSection): Values {
  if (section) {
    return {
      courseCode: section.courseCode,
      sectionCode: section.sectionCode,
      academicYear: String(toBuddhistYear(section.academicYear)),
      term: String(section.term),
      latitude: String(section.latitude),
      longitude: String(section.longitude),
      radiusMeters: String(section.radiusMeters),
    };
  }
  const year = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric" }).format(new Date()));
  return {
    courseCode: "",
    sectionCode: "1",
    academicYear: String(toBuddhistYear(year)),
    term: "1",
    latitude: "",
    longitude: "",
    radiusMeters: "50",
  };
}

export function ClassSectionForm({ section }: { section?: ClassSection }) {
  const router = useRouter();
  const editing = section !== undefined;
  const [values, setValues] = useState<Values>(() => initialValues(section));
  const [course, setCourse] = useState<CourseSummary | null>(null);
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

  // Leaving an empty field is not a mistake yet - empty required fields are
  // reported on submit. A filled-in value is checked as soon as it is left.
  function blur(name: FieldName) {
    if (values[name].trim() === "" && !errors[name]) {
      return;
    }
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

    const body = toRequestBody(values, editing);

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
        <p className="text-sm/relaxed text-on-surface-variant">ช่องที่มี * จำเป็นต้องกรอก</p>
        <div aria-live="assertive" className="sr-only">
          {announce}
        </div>
        {formError ? <Alert tone="danger" title="บันทึกไม่สำเร็จ">{formError}</Alert> : null}

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-2 flex items-center gap-2 font-display text-body-lg font-semibold text-on-surface">
            <span aria-hidden className="flex size-8 items-center justify-center rounded-xl bg-primary-container/10 text-primary-container">
              <BookOpenIcon size={16} />
            </span>
            รายวิชา
          </legend>
          {editing ? (
            <DescriptionList
              items={[
                { term: "รหัสวิชา", value: <span className="font-mono">{section.courseCode}</span> },
                {
                  term: "ชื่อวิชา",
                  value: section.courseInCatalog
                    ? section.courseName
                    : `${section.courseName} (ไม่อยู่ในรายวิชาของ Core Hub)`,
                },
                { term: "กลุ่มเรียน", value: section.sectionCode },
                { term: "ภาคเรียน", value: formatTerm(section.term, section.academicYear) },
              ]}
            />
          ) : (
            <CoursePicker
              selected={course}
              onSelect={(picked) => {
                setCourse(picked);
                set("courseCode", picked?.code ?? "");
                if (picked) setErrors((current) => ({ ...current, courseCode: undefined }));
              }}
              error={errors.courseCode}
              inputRef={(element) => {
                refs.current.courseCode = element;
              }}
            />
          )}

          {editing ? null : (
            <div className="grid gap-4 md:grid-cols-3">
              <FormField id="sectionCode" label="กลุ่มเรียน" required hint="ตัวเลข เช่น 1" error={errors.sectionCode}>
                <TextInput
                  {...input("sectionCode", { inputMode: "numeric", hint: "ตัวเลข เช่น 1" })}
                  onChange={(event) => set("sectionCode", event.target.value.replace(/\D/g, ""))}
                />
              </FormField>
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

        <hr className="border-outline-variant/40" />

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-2 flex items-center gap-2 font-display text-body-lg font-semibold text-on-surface">
            <span aria-hidden className="flex size-8 items-center justify-center rounded-xl bg-primary-container/10 text-primary-container">
              <MapPinIcon size={16} />
            </span>
            จุดเช็คชื่อ
          </legend>
          <p className="text-sm/relaxed text-on-surface-variant">
            ยืนอยู่ในห้องเรียนแล้วกดใช้ตำแหน่งปัจจุบัน นักศึกษาต้องอยู่ภายในรัศมีจากจุดนี้จึงจะเช็คชื่อได้
          </p>
          <div>
            <Button variant="secondary" onClick={fillMyLocation} loading={locating}>
              <CrosshairIcon size={16} />
              ใช้ตำแหน่งปัจจุบันของฉัน
            </Button>
          </div>
          {locationNote ? (
            <p aria-live="polite" className="text-sm/relaxed text-on-surface-variant">
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
          </div>
        </fieldset>

        <div className="flex flex-col gap-2 border-t border-outline-variant/40 pt-6 sm:flex-row">
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
