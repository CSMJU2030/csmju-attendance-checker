# REPORT — csmju-attendance-checker

ระบบเช็คชื่อเข้าเรียน: อาจารย์เปิดรอบเช็คชื่อแล้วแสดงรหัส 6 หลักในห้อง (เปลี่ยนทุก 2 นาที)
นักศึกษากรอกรหัสพร้อมตำแหน่ง GPS ระบบรับเฉพาะคนที่อยู่ในรัศมีของห้อง และเก็บสถานะ `PRESENT` / `LATE`

เป้าหมาย conformance: **L3** · standards **v1.0.0** · รันวันที่ 2026-09-29

## ผลรัน

```
$ ./standards/scripts/run-all-checks.sh .
  ✅ PASS  Security & Stack Scan       check-authorized-deps.sh
  ✅ PASS  API Contract Sync           check-openapi-sync.sh
  ✅ PASS  API Contract Sync           check-api-conventions.sh
  ✅ PASS  Data Dictionary Compliance  check-field-aliases.sh
  ✅ PASS  Data Dictionary Compliance  check-snake-case.sh
  ✅ PASS  Data Dictionary Compliance  check-no-hardcoded-faculty.sh
  ✅ PASS  Data Dictionary Compliance  check-money-fields.sh
  ✅ PASS  UI Token Compliance         check-ui-tokens.sh
  ✅ PASS  Code Quality                check-qa.sh
  ✅ PASS  Exception Validation        check-exceptions.sh
```

17/18 ข้อผ่านบนเครื่องพัฒนา ข้อที่ไม่ผ่านคือ `check-no-secrets.sh` (SEC-01) เพราะสคริปต์สแกนเจอ
`DATABASE_URL` ใน `backend/.env` ของเครื่อง ไฟล์นี้ถูก gitignore และไม่เคยถูก commit
เมื่อรันเช็กเดียวกันบนสำเนาที่ไม่มี `.env` (สภาพเดียวกับ CI ที่ checkout ใหม่) ผลคือ
`✅ [SEC-01/02] ไม่พบ secret หรือ .env ที่มีค่าจริง` — ดูหัวข้อ "สิ่งที่ยังทำไม่ได้"

```
$ node standards/conformance/run.js --manifest subsystem.yaml --level L3
  PASS  L3-10      the session cookie alone reaches /api/v1/me
  PASS  L3-11      cookie session identifies the same Core Hub user

── L3 · SSO — rejected handoffs
  PASS  L3-12      callback with a tampered token → 401
  PASS  L3-13      no session cookie is issued for a rejected token
  PASS  L3-14      callback without a token → 400 or 401
  PASS  L3-15      Core Hub rejects an unregistered callback_url

────────────────────────────────────────────────────────────
RESULT: 63 passed · 0 failed · 0 skipped
✅ CONFORMANT — csmju-attendance-checker meets standard v1.0 L3
```

ผลตรวจเพิ่มเติม:

| ตรวจ | ผล |
|---|---|
| `pnpm --filter backend typecheck` · `lint` · `build` | ผ่าน |
| `pnpm --filter backend test` | 11 suites · 81 tests ผ่าน |
| `pnpm --filter backend test:e2e` | 2 suites · 60 tests ผ่าน |
| `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` | No difference detected |
| `prisma migrate status` | 3 migrations · Database schema is up to date |
| `git -C standards status --short` | ว่าง (ไม่ได้แก้ standards/) |

## ไฟล์ที่สร้าง/แก้ไข

- `subsystem.yaml` — ประกาศชื่อ ระดับ L3 และ `probes` ของ `/api/v1/class-sections` ครบทุกเคส (ไม่มี SKIP)
- `backend/prisma/schema.prisma` — โดเมนเช็คชื่อ: `class_sections` · `attendance_sessions` · `attendance_records`
- `backend/prisma/migrations/20260929120000_attendance_domain/` — migration ใหม่ต่อจากของเดิม (ไม่ลบ/ไม่ squash migration เดิม)
- `backend/prisma/seed.ts` — ข้อมูลตัวอย่างกลุ่มเรียน CS201
- `backend/src/class-sections/` — CRUD กลุ่มเรียน · `?mine=true` · ลบได้เฉพาะกลุ่มที่ยังไม่มีรอบเช็คชื่อ
- `backend/src/attendance-sessions/` — เปิด/ปิดรอบ · รหัส TOTP 6 หลักจาก `code_secret` · ดูรายชื่อผู้เช็คชื่อ
- `backend/src/attendance-records/` — เช็คชื่อ (ตรวจรหัส · ความแม่นยำ GPS · รัศมี · ซ้ำ · มาสาย) · ประวัติของตัวเอง · ล็อกเมื่อกรอกรหัสผิดหลายครั้ง
- `backend/src/common/geo.ts` — คำนวณระยะทาง haversine (ไฟล์ใหม่ ไม่ได้แตะ envelope/exception filter)
- `backend/src/auth/permissions.ts` — permission ของโดเมน (ดูด้านล่าง)
- `backend/src/auth/role-mapping.ts` — ตัด `alumni` ออกให้ตรงกับทะเบียน
- `backend/src/app.module.ts` · `config/configuration.ts` · `prisma/prisma.service.ts` · `.env.example` — ผูกโมดูลใหม่และค่าตั้งของระบบนี้
- `backend/test/` — e2e ของโดเมนใหม่ และปรับ in-memory Prisma ให้มีตารางใหม่
- ลบ `backend/src/{students,courses,enrollments}/` — เป็นโดเมนตัวอย่างของ demo ที่ไม่ใช้ในระบบนี้

## ชั้น auth ที่คัดลอกมา

- คัดลอกจาก demo-student-subsystem: `jwks.service.ts` · `core-hub-token.verifier.ts` · `auth.errors.ts` ·
  `core-hub-identity.ts` · `sso-callback.controller.ts` · `sso-session.ts` · `me.controller.ts` ·
  `guards/` · `decorators/` · `common/` (envelope + exception filter)
- แก้ไข: ไม่มี (ตรวจด้วย `diff` กับ reference แล้วเหมือนกันทุกไฟล์)
  — `role-mapping.ts` แก้เฉพาะค่าในตาราง ตามที่ AGENTS.md ข้อ 2 อนุญาต

## Role mapping ที่ประกาศ (ต้องตรงกับ default_role_mapping ในทะเบียน)

ตรวจจาก `GET /api/v1/subsystems/90488e31-da29-41d8-b63a-1b2694de0d9d/role-mapping`
→ `{"admin":"ADMIN","staff":"STAFF","student":"STUDENT"}` ตรงกับโค้ด

| core role | subsystem role |
|---|---|
| student | STUDENT |
| staff | STAFF |
| admin | ADMIN |
| alumni | — (ไม่ได้ลงทะเบียน · ได้ 403 `FORBIDDEN`) |

Permission ต่อ role:

| permission | STUDENT | STAFF | ADMIN |
|---|:-:|:-:|:-:|
| `class-section:read` | | ✓ | ✓ |
| `class-section:create` | | ✓ | ✓ |
| `class-section:update:own` / `:any` | | own | ✓ |
| `class-section:delete:own` / `:any` | | own | ✓ |
| `attendance-session:manage:own` / `:any` | | own | ✓ |
| `attendance:check-in` | ✓ | | ✓ |
| `attendance-record:read:own` | ✓ | | ✓ |

การตรวจ `:own` ทำในชั้น service เทียบกับ `owner_core_user_id` ของกลุ่มเรียน

## ข้อสมมติที่ตั้งเอง (เพราะมาตรฐานไม่ได้ระบุ)

1. นักศึกษากรอกแค่รหัส 6 หลัก ระบบหารอบเช็คชื่อที่เปิดอยู่จากรหัสเอง ถ้ารหัสตรงมากกว่า 1 รอบถือว่าไม่ถูกต้อง (400)
2. รหัสเปลี่ยนทุก 120 วินาที และคำนวณจาก `code_secret` ที่ไม่ออกจาก backend จึงไม่เก็บรหัสลง DB
3. ตำแหน่งที่คลาดเคลื่อนเกิน 100 เมตร (`accuracyMeters`) ถือว่าพิสูจน์ไม่ได้ว่าอยู่ในห้อง → 400
4. อยู่นอกรัศมี · เช็คชื่อซ้ำ · ถูกล็อกเพราะกรอกผิดหลายครั้ง → 409 `CONFLICT`
5. เก็บเฉพาะระยะห่าง (`distance_meters`) ไม่เก็บพิกัดดิบของนักศึกษา
6. กลุ่มเรียนหนึ่งเปิดได้ครั้งละ 1 รอบ (เปิดซ้ำ → 409)
7. ลบกลุ่มเรียนที่มีรอบเช็คชื่อแล้วไม่ได้ (409) เพราะ cascade จะลบประวัติเช็คชื่อของนักศึกษาไปด้วย
8. ตัวนับการกรอกรหัสผิดอยู่ในหน่วยความจำของ process — ถ้ารันหลาย instance ต้องย้ายไปเก็บที่ส่วนกลาง
9. ปีการศึกษาเก็บเป็น ค.ศ. ในข้อมูล ส่วน UI แสดงเป็น พ.ศ.

## สิ่งที่ยังทำไม่ได้ / เคสที่ยังไม่ผ่าน

- `check-no-secrets.sh` (SEC-01) ไม่ผ่านเฉพาะบนเครื่องพัฒนา เพราะสแกนเจอ `backend/.env` ที่ gitignore ไว้
  ย้ายไป `.env.local` ก็ไม่ช่วย เพราะสคริปต์สแกน `*.env*` ทั้งหมด บน CI (checkout ใหม่ ไม่มี `.env`) ผ่าน
  — แจ้ง PL ว่าเช็กนี้ให้ผลต่างกันระหว่างเครื่องพัฒนากับ CI
- frontend (`frontend/src/`) ยังไม่ได้เริ่ม
