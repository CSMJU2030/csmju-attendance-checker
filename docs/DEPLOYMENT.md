# ขึ้นเซิร์ฟเวอร์จริง — csmju-attendance-checker

ระบบนี้ขึ้น server กลางของรายวิชาตาม **standards `docs/deployment.md`** (มาตรฐาน 1.8.1) — เอกสารนั้นคือฉบับหลัก
ไฟล์นี้สรุปเฉพาะส่วนของระบบเช็คชื่อ

## 1. ภาพรวม

```
ผู้ใช้ ─https─► Cloudflare ─► Apache ─► web (Next.js :3000) ─► api (NestJS :4000) ─► PostgreSQL กลาง
                                         เปิดผ่าน Apache        ไม่เปิดออกนอก          ฐานของระบบเอง
```

- **2 image:** `ghcr.io/csmju2030/csmju-attendance-checker-web` และ `-api` — GitHub Actions build ให้เองทุกครั้งที่ merge เข้า `main`
  (แท็บ **Actions → Images**) · server แค่ดึง image ไปรัน ไม่ build บน server
- **DevOps ทำบน server:** สร้างฐานข้อมูล + role · compose · Apache · ทีมไม่ต้องเข้าเครื่อง
- **ต้องเป็น https** — มือถือให้ใช้ตำแหน่ง (GPS) เฉพาะหน้าที่เป็น https และคุกกี้เข้าสู่ระบบในโหมดใช้งานจริงเป็นแบบ `Secure`
- ระบบไม่เก็บไฟล์ ไม่มีงานตั้งเวลา · ข้อมูลทั้งหมดอยู่ในฐานข้อมูลของระบบเอง

## 2. env ที่ server ต้องตั้ง

**api** — รายการเต็มอยู่ใน `backend/.env.example` (DevOps ใช้ไฟล์นั้นเป็นรายการ env)

| ค่า | บนเซิร์ฟเวอร์จริง |
|---|---|
| `NODE_ENV` · `PORT` · `TZ` | `production` · `4000` · `Asia/Bangkok` |
| `DATABASE_URL` · `DATABASE_POOL_MAX` | DevOps กำหนด · `5` |
| `CORE_HUB_URL` · `CORE_HUB_WEB_URL` | `https://csmju2030.jowave.com` |
| `CORE_HUB_JWKS_URL` | `https://csmju2030.jowave.com/api/v1/.well-known/jwks.json` |
| `CORE_HUB_ISSUER` · `CORE_HUB_AUDIENCE` | `core-hub` · `csmju2030` (ห้ามเปลี่ยน) |
| `SUBSYSTEM_ID` · `SUBSYSTEM_NAME` | `csmju-attendance-checker` · `Attendance Checker` |

ระบบนี้ไม่มีค่าลับของทีมเอง · ถ้าค่าใดขาด api จะไม่ยอมเปิดและบอกชื่อค่าที่ขาด (`Missing required environment variables: …`)

**web** — `CORE_HUB_WEB_URL` · `SUBSYSTEM_ID` · `TZ` (`BACKEND_URL` = `http://api:4000` ฝังใน image แล้ว)

## 3. ก่อนวันเปิดใช้

1. ชื่อเว็บตามแผนคือ `https://csmju-attendance-checker.jowave.com` (รออาจารย์อนุมัติ)
2. **PL ขอ admin ระบบกลางเปลี่ยน Callback URL ใน Core Hub** จาก `http://localhost:3202/auth/callback`
   เป็น `https://<ชื่อเว็บ>/auth/callback` — ไม่ต้องยื่นคำขอระบบย่อยใหม่ (ชื่อซ้ำจะถูกปฏิเสธ)
3. เปิดเว็บ กด "เข้าสู่ระบบผ่าน Core Hub" แล้วลองเช็คชื่อด้วยมือถือจริง

คิวอาร์โค้ดในหน้าอาจารย์สร้างจากที่อยู่ที่เปิดเว็บอยู่ ไม่ต้องตั้งค่าเพิ่ม

## 4. ทดสอบแบบเดียวกับ server ในเครื่อง

```bash
docker compose up -d --build     # db + api + web → http://localhost:3202 (ใช้ Chrome)
docker compose ps                # ทั้งสามต้อง healthy
docker compose logs api          # ต้องเห็น migration ผ่าน และ subsystem.started
docker compose down              # หยุด (ข้อมูลยังอยู่ใน volume)
```

api และ web ล็อกแบบเดียวกับ server (ระบบไฟล์อ่านอย่างเดียว · ไม่มีสิทธิ์พิเศษ · ผู้ใช้ `node`)

## 5. เรื่องที่ควรรู้

- **อัปเดตเวอร์ชัน:** merge เข้า `main` → ได้ image ใหม่ → DevOps `docker compose pull && docker compose up -d` · migration รันเองตอน api เปิด
- **log** ออก stdout เป็น JSON ไม่มี token · มีรหัสผู้ใช้ของ Core Hub ซึ่งถือเป็นข้อมูลบุคคล
- **เพดานของ Core Hub:** การเช็คชื่อหนึ่งครั้งเรียก Core Hub `GET /people/me` หนึ่งครั้ง Core Hub จำกัดไว้ **600 ครั้ง / 10 วินาที ต่อ IP**
  ของเซิร์ฟเวอร์ (reference-data ข้อ 7.2) — ถ้าหลายห้องเช็คชื่อพร้อมกันจนเกิน นักศึกษาจะได้ "ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง"
  และลองใหม่ได้ในไม่กี่วินาที · ทดสอบแล้ว 300 คนกดพร้อมกันสำเร็จครบภายใน 2.4 วินาที (PR #20)
- ข้อมูลอ้างอิงจาก Core Hub (รายวิชา สาขา) cache ไว้ 10 นาทีในหน่วยความจำของ api · ข้อมูลบุคคลไม่ cache
