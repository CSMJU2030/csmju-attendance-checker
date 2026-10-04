# ขึ้นเซิร์ฟเวอร์จริง — csmju-attendance-checker

คู่มือสำหรับคนที่นำระบบเช็คชื่อขึ้นเซิร์ฟเวอร์ (DevOps / PL) · ทดสอบโหมดใช้งานจริงด้วย Docker ในเครื่องแล้ว

## 1. ภาพรวม

```
เบราว์เซอร์ ──https──▶ reverse proxy (TLS) ──▶ หน้าเว็บ :3202 ──▶ ระบบหลังบ้าน :4202 ──▶ PostgreSQL :5432
                                                    │
                                                    └── /api/* /auth/* ส่งต่อไปหลังบ้าน (เบราว์เซอร์ไม่ต่อหลังบ้านตรง)
```

- เปิดสู่ภายนอก **แค่หน้าเว็บ** ผ่าน https · ระบบหลังบ้านและฐานข้อมูลอยู่ในเครื่อง (`docker-compose.yml` ผูกไว้ที่ `127.0.0.1` แล้ว)
- **ต้องเป็น https** — มือถือให้ใช้ตำแหน่ง (GPS) เฉพาะหน้าที่เป็น https และคุกกี้เข้าสู่ระบบในโหมดใช้งานจริงเป็นแบบ `Secure`
- ระบบไม่เก็บไฟล์ ไม่มีงานตั้งเวลา · ข้อมูลทั้งหมดอยู่ใน PostgreSQL ของระบบเอง

## 2. ค่าที่ต้องตั้ง (`.env` ข้าง `docker-compose.yml` — ห้าม commit)

ตัวอย่างอยู่ใน `.env.example`

| ค่า | บนเซิร์ฟเวอร์จริง |
|---|---|
| `NODE_ENV` | `production` (คุกกี้ Secure · บังคับตั้งค่า Core Hub ครบ · ตรวจว่า JWKS เป็น https) |
| `POSTGRES_PASSWORD` | รหัสยาวที่สุ่มขึ้นมา เช่น `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"` |
| `CORE_HUB_URL` · `CORE_HUB_WEB_URL` | `https://csmju2030.jowave.com` |
| `CORE_HUB_JWKS_URL` | `https://csmju2030.jowave.com/api/v1/.well-known/jwks.json` |
| `CORE_HUB_ISSUER` · `CORE_HUB_AUDIENCE` | `core-hub` · `csmju2030` (ห้ามเปลี่ยน) |

ถ้าค่าใดขาด ระบบหลังบ้านจะไม่ยอมเปิด และบอกชื่อค่าที่ขาด (`Missing required environment variables: …`)

## 3. ขั้นตอน

1. ดึงโค้ดจาก `main` แล้วสร้าง `.env` ตามข้อ 2
2. `docker compose up -d --build` — ตอนเปิด ระบบหลังบ้านสร้าง/อัปเดตตารางในฐานข้อมูลเอง (`prisma migrate deploy`)
3. ตั้ง reverse proxy (เช่น nginx / Caddy) ให้โดเมน https ส่งต่อไปที่ `127.0.0.1:3202` · ส่ง header `Host` และ `X-Forwarded-Proto` ต่อตามปกติ
4. ตรวจ: `https://<โดเมน>/api/health` ต้องได้ `{"success":true,"data":{"status":"ok",…}}`
5. **ให้ admin ระบบกลางเปลี่ยน Callback URL ใน Core Hub** จาก `http://localhost:3202/auth/callback` เป็น `https://<โดเมน>/auth/callback`
   (subsystem-registry ข้อ 7 — ทีมแก้เองไม่ได้หลังอนุมัติ และ callback แบบ localhost จะใช้ไม่ได้เมื่อ server ปิดโหมดทดสอบ)
6. เปิด `https://<โดเมน>` กด "เข้าสู่ระบบผ่าน Core Hub" แล้วลองเช็คชื่อด้วยมือถือ

คิวอาร์โค้ดในหน้าอาจารย์สร้างจากที่อยู่ที่เปิดเว็บอยู่ ไม่ต้องตั้งค่าเพิ่ม

## 4. หลังขึ้นระบบ

- **อัปเดตเวอร์ชัน:** ดึง `main` ใหม่ → `docker compose up -d --build` (migration รันเองตอนเปิด)
- **สำรองข้อมูล:** `docker exec attendance-checker-db pg_dump -U postgres attendance_checker_db > backup.sql`
- **ดู log:** `docker logs attendance-checker-api` (log เป็น JSON ไม่มี token · มีรหัสผู้ใช้ของ Core Hub ซึ่งถือเป็นข้อมูลบุคคล เก็บ log อย่างระวัง)
- **ตรวจสถานะ:** ทั้ง 3 container มี healthcheck — `docker compose ps` ต้องเห็น `healthy`

## 5. เรื่องที่ควรรู้

- **เพดานของ Core Hub:** การเช็คชื่อหนึ่งครั้งเรียก Core Hub `GET /people/me` หนึ่งครั้ง Core Hub จำกัดไว้ **600 ครั้ง / 10 วินาที ต่อ IP**
  ของเซิร์ฟเวอร์ (reference-data ข้อ 7.2) — ถ้าหลายห้องเช็คชื่อพร้อมกันจนเกิน นักศึกษาจะได้ "ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง"
  และลองใหม่ได้ในไม่กี่วินาที (ผลทดสอบโหลดอยู่ใน PR ที่เพิ่มไฟล์นี้)
- ข้อมูลอ้างอิงจาก Core Hub (รายวิชา สาขา) cache ไว้ 10 นาทีในหน่วยความจำของระบบหลังบ้าน · ข้อมูลบุคคลไม่ cache
