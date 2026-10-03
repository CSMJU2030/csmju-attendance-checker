# REPORT — csmju-attendance-checker

ระบบเช็คชื่อเข้าเรียน: อาจารย์เปิดรอบเช็คชื่อแล้วแสดงรหัส 6 หลักในห้อง (เปลี่ยนทุก 2 นาที)
นักศึกษากรอกรหัสพร้อมตำแหน่ง GPS ระบบรับเฉพาะคนที่อยู่ในรัศมีของห้อง (ตั้งแต่ 2026-10-03 ไม่มีสถานะ `LATE` แล้ว: เช็คชื่อได้จนกว่าอาจารย์จะปิดรอบ)

เป้าหมาย conformance: **L3** · standards **v1.0.0** · รันวันที่ 2026-09-29

มีทั้ง backend (NestJS, :4202) และ frontend (Next.js, :3202) · conformance รันผ่าน frontend
(`base_url: http://localhost:3202`) ซึ่งส่ง `/api/*` ต่อไป backend และรับ SSO ที่ `/auth/callback`

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
| `pnpm --filter backend test` | 11 suites · 85 tests ผ่าน |
| `pnpm --filter backend test:e2e` | 2 suites · 61 tests ผ่าน |
| `pnpm --filter frontend typecheck` · `lint` · `build` | ผ่าน (11 routes) |
| smoke test ผ่าน SSO จริง (Core Hub handoff → `/auth/callback` → cookie) | ทุกหน้าของ staff/student/ผู้ที่ยังไม่ล็อกอิน แสดงถูกต้อง · เช็คชื่อผ่าน proxy สำเร็จ · ออกจากระบบล้าง cookie |
| browser E2E (Chrome headless · Playwright + axe-core, นอก repo) | **73 passed · 0 failed** — ตัวเลขสรุปในหน้าแรกของนักศึกษา/อาจารย์ · SSO จริงทั้งอาจารย์/นักศึกษา · สร้างกลุ่มเรียน + "ใช้ตำแหน่งปัจจุบัน" (จำลอง GPS) · เปิดรอบ รหัส 6 หลัก นับถอยหลัง · นักศึกษา: รหัสผิด → error ใต้ช่อง, นอกรัศมี → แจ้งระยะ, ในรัศมี → สำเร็จ, ซ้ำ → แจ้ง · รายชื่ออัปเดตเอง · ConfirmDialog (Esc, focus กลับจุดเดิม) · ลบถูกปิดพร้อมเหตุผลเมื่อมีประวัติ · ค้นหา/ว่าง · drawer มือถือ · skip link · ออกจากระบบ · axe 0 critical/serious ทุกหน้าที่ตรวจ · ไม่มี horizontal scroll ที่ 360/768/1280px ทุกหน้า |
| `pnpm --filter frontend test` (vitest) | 6 files · **48 tests ผ่าน** — error mapping ตาม 9.3 · การจัดประเภท error ของการเช็คชื่อ · สิทธิ์/เมนูตามบทบาท · validation ฟอร์มกลุ่มเรียน + แปลง พ.ศ.→ค.ศ. · รูปแบบวันที่และการจัดกลุ่มตามวันแบบ Asia/Bangkok · ตรวจแล้วว่า test ตีตกเมื่อแก้โค้ดให้ผิด |
| Lighthouse 12 (production build · มือถือ = slow 4G + CPU 4x) | 8 หน้า: performance **94–100** · accessibility **100 ทุกหน้า** · best-practices 100 · CLS ≤ 0.002 · JS แรกเข้า ~132 KB (gzip) · **LCP มือถือ 2.5–2.7 s (ค่ากลาง 3 รอบ 2.39–2.55 s) ชนเพดาน 2.5 s ของข้อ 15** — ดูหัวข้อ "สิ่งที่ยังทำไม่ได้" |
| Docker (`docker compose up --build`) | build ผ่านทั้ง 2 image · db/api/web healthy · migration 3 ตัวรันบนฐานข้อมูลเปล่า · frontend ส่ง `/api` ต่อให้ backend ได้ · backend ตรวจ token จริงผ่าน JWKS ของ Core Hub บน host · สร้างกลุ่มเรียน → เปิดรอบ → นักศึกษาเช็คชื่อ `PRESENT` · นักศึกษาสร้างกลุ่มเรียน → 403 · ไม่มี `.env`/กุญแจใน image · RAM ขณะรันรวม ~170 MB |
| dependency whitelist (ARC-02/03) | เครื่องนี้ไม่มี `jq` สคริปต์จึงข้าม — ตรวจด้วย node กับ `allowed-deps.json` แทน: ผ่านทุกตัว |
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
- `backend/src/attendance-records/` — เช็คชื่อ (ตรวจรหัส · ความแม่นยำ GPS · รัศมี · ซ้ำ) · ประวัติของตัวเอง · ล็อกเมื่อกรอกรหัสผิดหลายครั้ง
- `backend/src/common/geo.ts` — คำนวณระยะทาง haversine (ไฟล์ใหม่ ไม่ได้แตะ envelope/exception filter)
- `backend/src/auth/permissions.ts` — permission ของโดเมน (ดูด้านล่าง)
- `backend/src/auth/role-mapping.ts` — ตัด `alumni` ออกให้ตรงกับทะเบียน
- `backend/src/app.module.ts` · `config/configuration.ts` · `prisma/prisma.service.ts` · `.env.example` — ผูกโมดูลใหม่และค่าตั้งของระบบนี้
- `backend/test/` — e2e ของโดเมนใหม่ และปรับ in-memory Prisma ให้มีตารางใหม่
- ลบ `backend/src/{students,courses,enrollments}/` — เป็นโดเมนตัวอย่างของ demo ที่ไม่ใช้ในระบบนี้
- `backend/src/attendance-sessions/` — รอบเช็คชื่อส่ง `recordCount` (นับด้วย `groupBy` ครั้งเดียวต่อหน้า)
- `backend/src/attendance-records/` — `GET /api/v1/attendance-records/me/summary` → `{ total }` ของนักศึกษาเอง
- `frontend/` — Next.js 16 App Router + Tailwind 3 (ดูหัวข้อ "frontend" ด้านล่าง)
- `pnpm-workspace.yaml` · `package.json` — เพิ่ม workspace `frontend` และ script `start:dev:frontend`
- `subsystem.yaml` — `base_url` เปลี่ยนเป็น frontend `http://localhost:3102`
- ทะเบียน Core Hub (เครื่อง dev) — `callback_url` เปลี่ยนเป็น `http://localhost:3102/auth/callback`

## frontend

| ส่วน | ไฟล์ |
|---|---|
| App shell · เมนูตามสิทธิ์ · 401/403 | `src/app/layout.tsx` · `src/components/shared/access-gate.tsx` · `src/lib/permissions.ts` |
| SSO callback / ออกจากระบบ | `src/app/auth/callback/route.ts` · `src/app/auth/logout/route.ts` |
| นักศึกษา: เช็คชื่อ · ประวัติ | `src/app/check-in/` · `src/app/attendance-records/` |
| อาจารย์: กลุ่มเรียน · ฟอร์ม · ลบ | `src/app/class-sections/**` · `src/components/features/class-section-form.tsx` · `section-actions.tsx` |
| อาจารย์: แสดงรหัสขึ้นจอ + รายชื่อสด | `src/app/attendance-sessions/[id]/` · `src/components/features/live-session.tsx` |
| เรียก API · map error ตาม 9.3 | `src/lib/api-server.ts` · `api-client.ts` · `errors.ts` |
| design system (ตัวแทนชั่วคราว) | `frontend/design-system/tokens.css` · `src/design-system/` |

- `/auth/callback` ของ frontend ส่ง query ต่อให้ `/auth/callback` ของ backend ตรวจ (JWKS · role mapping · cookie)
  สำเร็จแล้วส่ง `Set-Cookie` ของ backend กลับพร้อม redirect ไป `/` ถ้า backend ปฏิเสธ (400/401/403) จะส่งคำตอบเดิมกลับโดยไม่ตั้ง cookie
  — ชั้น auth ของ backend จึงไม่ถูกแก้
- ไม่มีหน้า login: ปุ่ม "เข้าสู่ระบบผ่าน Core Hub" ลิงก์ไป SSO launcher ของ portal (`:3100/api/sso/csmju-attendance-checker`)
- token ไม่เคยถูกอ่านด้วย JavaScript — อยู่ใน cookie HttpOnly เท่านั้น ไม่ใช้ `localStorage`

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
9. ปีการศึกษาเก็บเป็น ค.ศ. ในข้อมูล ส่วน UI แสดงและรับค่าเป็น พ.ศ. (แปลงก่อนส่ง API)
10. `@csmju2030/design-system` ไม่มีใน registry ที่เครื่องนี้เข้าถึงได้ (npm ตอบ 404) จึงทำตัวแทนชั่วคราว:
    token ทุกค่าคัดลอกจาก `ui-design-system.md` ข้อ 3 ไว้ที่ `frontend/design-system/tokens.css`
    และ component ชื่อ/props ตามข้อ 7 ไว้ที่ `src/design-system/` โดย `tsconfig` map ชื่อ package มาที่โฟลเดอร์นี้
    — โค้ดหน้าจอ import จาก `@csmju2030/design-system` อยู่แล้ว เมื่อได้ package จริงให้ติดตั้งแล้วลบโฟลเดอร์ตัวแทนทิ้ง
11. ใช้ Tailwind 3 (ไม่ใช่ 4) เพราะ Tailwind 4 ต้องใช้ `@tailwindcss/postcss` ซึ่งไม่อยู่ใน whitelist
12. ฟอนต์: self-host ใน `frontend/public/fonts/` 4 ไฟล์ (~72 KB) — IBM Plex Sans Thai (ตัวไทย) + Inter (ตัวละติน) น้ำหนัก 400/600
    ผ่าน `@font-face` + `unicode-range` · `font-display: swap` · preload เฉพาะไทย 400/600 · ไลเซนส์ SIL OFL อยู่ข้างไฟล์
    `@fontsource/*` ไม่อยู่ใน whitelist จึงเก็บไฟล์เอง · Plus Jakarta Sans (หัวเรื่อง) ไม่ได้โหลดเพราะเกินงบ 4 ไฟล์ ตัวละตินในหัวเรื่องจึงใช้ Inter
    · มีแค่ 400/600 จึงใช้ `font-semibold` แทน `font-bold`/`font-medium` และปิด `font-synthesis-weight` กันตัวหนาปลอม (ข้อ 4.1)
13. ไอคอน Lucide ฝังเป็น SVG ใน `src/design-system/icons.tsx` เพราะ `lucide-react` ไม่อยู่ใน whitelist
14. type ของ API เขียนตาม DTO ของ backend ใน `src/lib/types.ts` เพราะ backend ยังไม่มี `openapi.json` ให้ generate
15. ข้อความ error: แสดง `error.message` ของ backend เฉพาะ `BAD_REQUEST`/`CONFLICT` ที่เป็นภาษาไทย (ข้อความของโดเมนนี้)
    ที่เหลือใช้ข้อความมาตรฐานตามตาราง 9.3 เพราะ `VALIDATION_ERROR` ของ class-validator เป็นภาษาอังกฤษ
16. หน้ารอบเช็คชื่อดึงรายชื่อใหม่ทุก 5 วินาที และดึงรหัสใหม่ทันทีที่หมดช่วง 2 นาที (ไม่มี websocket)

## สิ่งที่ยังทำไม่ได้ / เคสที่ยังไม่ผ่าน

- `check-no-secrets.sh` (SEC-01) ไม่ผ่านเฉพาะบนเครื่องพัฒนา เพราะสแกนเจอ `backend/.env` ที่ gitignore ไว้
  ย้ายไป `.env.local` ก็ไม่ช่วย เพราะสคริปต์สแกน `*.env*` ทั้งหมด บน CI (checkout ใหม่ ไม่มี `.env`) ผ่าน
  — แจ้ง PL ว่าเช็กนี้ให้ผลต่างกันระหว่างเครื่องพัฒนากับ CI
- ยังไม่ได้ทดสอบบนมือถือจริงและ screen reader (NVDA/VoiceOver) — ทดสอบด้วย Chrome headless ที่จำลองจอ 360px + touch
- GPS ใช้ได้เฉพาะ secure context (`https` หรือ `localhost`) — ถ้าเปิดผ่าน IP ในวง LAN แบบ http นักศึกษาจะเช็คชื่อไม่ได้
- **LCP บนมือถือชนเพดาน 2.5 s** (Lighthouse slow 4G + CPU 4x): ทดลองแล้วว่าไม่ได้มาจากฟอนต์ (ปิด preload แล้วแย่ลงเป็น 2.55–2.66 s)
  สาเหตุคือเนื้อหาหน้า stream ตามหลัง skeleton ของ `loading.tsx` (มาตรฐานบังคับให้มีทุก route) และ Lighthouse นับว่ารอ JS
  ทำ streaming ให้ส่วนที่ไม่ต้องรอข้อมูลขึ้นก่อนแล้ว · performance score ยังผ่าน (94–99) · ถ้าต้องให้ต่ำกว่า 2.5 s ชัด ๆ
  ต้องตัดสินว่าจะเอา `loading.tsx` ออกจากหน้าที่ไม่ต้องรอข้อมูลหรือไม่ — ขอความเห็น PL
- unit test ของ frontend ครอบคลุมเฉพาะ logic ล้วน — ยังไม่มี component test เพราะ `@testing-library/react`
  ต้องใช้ `@testing-library/dom` ซึ่งไม่อยู่ใน whitelist (พฤติกรรม component ตรวจด้วย browser E2E แทน)
- image ของ backend ใหญ่ (1.77 GB) เพราะ runtime ติดตั้ง dependency ของ Prisma CLI ไว้รัน `migrate deploy` ตอนเริ่ม — ยังไม่ได้ลดขนาด
