# csmju-attendance-checker

Attendance Checker (ระบบเช็คชื่อเข้าเรียน) — ระบบย่อยของโครงการ CSMJU2030

อาจารย์เปิดรอบเช็คชื่อแล้วแสดงรหัส 6 หลักในห้อง (เปลี่ยนทุก 2 นาที) นักศึกษากรอกรหัสบนมือถือ
ระบบตรวจตำแหน่ง GPS ว่าอยู่ในรัศมีของห้องแล้วบันทึกเป็น "มาตรงเวลา" หรือ "มาสาย"

มาตรฐานกลางอยู่ใน `standards/` (submodule ของ CSMJU2030/csmju2030-standards)
สร้างจาก standards v1.0.0

## โครงสร้าง

| โฟลเดอร์ | อะไร | พอร์ต |
|---|---|---|
| `backend/` | NestJS 11 + Prisma 7.9.1 + PostgreSQL — API, ตรวจ token ผ่าน JWKS, สิทธิ์ทั้งหมด | 3002 |
| `frontend/` | Next.js 16 (App Router) + Tailwind 3 — หน้าจอทั้งหมด | 3102 |

เบราว์เซอร์คุยกับ frontend (:3102) ที่เดียว frontend ส่ง `/api/*` ต่อไป backend แบบไม่แตะข้อมูล
และรับ SSO ที่ `/auth/callback` (ส่ง token ให้ backend ตรวจ แล้ว redirect เข้าหน้าเว็บ)

## เริ่มทำงาน

ต้องมี Core Hub รันอยู่ที่ :3000 (API) และ :3100 (portal) ก่อน

```bash
git submodule update --init --remote standards/
pnpm install

cp backend/.env.example backend/.env           # แก้ DATABASE_URL ให้เป็นฐานข้อมูลของเครื่องคุณ
cp frontend/.env.example frontend/.env.local

pnpm --filter backend prisma:deploy
pnpm --filter backend prisma:seed

pnpm start:dev                  # backend  → http://localhost:3002
pnpm start:dev:frontend         # frontend → http://localhost:3102
```

เปิด http://localhost:3102 แล้วกด "เข้าสู่ระบบผ่าน Core Hub" (บัญชี dev อยู่ใน `standards/fixtures/dev-accounts.json`)

ทะเบียนใน Core Hub ต้องมี `callback_url = http://localhost:3102/auth/callback`

## รันด้วย Docker

```bash
docker compose up --build        # db :5434 · backend :3002 · frontend :3102
```

ต้องมี Core Hub รันบนเครื่อง host (:3000 / :3100) · `BACKEND_URL` และ `NEXT_PUBLIC_*` ของ frontend
ถูกฝังตอน build image เปลี่ยนค่าแล้วต้อง `docker compose build` ใหม่

## ทดสอบ

```bash
pnpm --filter backend test
pnpm --filter backend test:e2e
pnpm --filter frontend test
pnpm --filter frontend typecheck
pnpm --filter frontend lint
pnpm --filter frontend build

./standards/scripts/run-all-checks.sh .
node standards/conformance/run.js --manifest subsystem.yaml --level L3
```

## หน้าจอ

| หน้า | ใครเห็น | ทำอะไร |
|---|---|---|
| `/` | ทุกคน | ภาพรวมตามบทบาท |
| `/check-in` | นักศึกษา | กรอกรหัส + ส่งตำแหน่ง → เช็คชื่อ |
| `/attendance-records` | นักศึกษา | ประวัติการเช็คชื่อของตัวเอง |
| `/class-sections` | อาจารย์ · ผู้ดูแล | รายการกลุ่มเรียน ค้นหา กรองเฉพาะของฉัน |
| `/class-sections/new` · `/[id]/edit` | อาจารย์ · ผู้ดูแล | เพิ่ม/แก้ไขกลุ่มเรียนและจุดเช็คชื่อ |
| `/class-sections/[id]` | อาจารย์ · ผู้ดูแล | รายละเอียด เปิดรอบเช็คชื่อ ลบ |
| `/attendance-sessions/[id]` | อาจารย์ · ผู้ดูแล | แสดงรหัสขึ้นจอ นับถอยหลัง รายชื่อสด ปิดรอบ |

ก่อนเปิด PR อ่าน `standards/docs/github-workflow.md` ข้อ 1
