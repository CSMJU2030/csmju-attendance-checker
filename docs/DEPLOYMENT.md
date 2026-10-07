# ขึ้นเซิร์ฟเวอร์จริง — csmju-attendance-checker

ระบบนี้ขึ้น server กลางของรายวิชาตาม **standards `docs/deployment.md`** (มาตรฐาน 1.8.4) — เอกสารนั้นคือฉบับหลัก
ไฟล์นี้สรุปเฉพาะส่วนของระบบเช็คชื่อ

## 1. ภาพรวม

```
ผู้ใช้ ─https─► Cloudflare ─► Apache (:443) ─► web (Next.js :3000) ─► api (NestJS :4000) ─► PostgreSQL กลาง
                               อ่านชื่อ → พอร์ต 50xx   127.0.0.1:50xx         ไม่เปิดออกนอก          ฐานของระบบเอง
```

- **พอร์ตของระบบนี้คือ `5001`** (รายชื่อพอร์ตของ PM) — ในเครื่องเปิดที่ `http://localhost:5001` · บน server หน้าเว็บอยู่ที่ `127.0.0.1:5001` และ Apache ส่งชื่อเว็บมาที่พอร์ตนี้ (`/etc/apache2/csmju-map.txt`)

- **2 image:** `ghcr.io/csmju2030/csmju-attendance-checker-web` และ `-api` — GitHub Actions build ให้เองทุกครั้งที่ merge เข้า `main`
  (แท็บ **Actions → Images**) · server แค่ดึง image ไปรัน ไม่ build บน server
- **DevOps ทำบน server:** จองพอร์ต · สร้างฐานข้อมูล + role · compose · ทดสอบบนชื่อเว็บจริงกับทีม · ทีมไม่ต้องเข้าเครื่อง
- **หน่วยความจำ:** api ไม่เกิน `512m` · web ไม่เกิน `384m` (เกินแล้วถูกปิด) · log หมุนไฟล์ละ 10 MB เก็บ 3 ไฟล์
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

1. ชื่อเว็บคือ `https://csmju-attendance-checker.jowave.com` (อาจารย์อนุมัติรูปแบบชื่อแล้ว 6 ต.ค. 2569 — รอ DevOps ขึ้นระบบ)
2. **PL ขอ admin ระบบกลางเปลี่ยน Callback URL ใน Core Hub** จาก `http://localhost:5001/auth/callback`
   เป็น `https://<ชื่อเว็บ>/auth/callback` — ไม่ต้องยื่นคำขอระบบย่อยใหม่ (ชื่อซ้ำจะถูกปฏิเสธ)
3. เปิดเว็บ กด "เข้าสู่ระบบผ่าน Core Hub" แล้วลองเช็คชื่อด้วยมือถือจริง

คิวอาร์โค้ดในหน้าอาจารย์สร้างจากที่อยู่ที่เปิดเว็บอยู่ ไม่ต้องตั้งค่าเพิ่ม

## 4. ทดสอบแบบเดียวกับ server ในเครื่อง

```bash
docker compose up -d --build     # db + api + web → http://localhost:5001 (ใช้ Chrome)
docker compose ps                # ทั้งสามต้อง healthy
docker compose logs api          # ต้องเห็น migration ผ่าน และ subsystem.started
docker compose down              # หยุด (ข้อมูลยังอยู่ใน volume)
```

api และ web ล็อกแบบเดียวกับ server (ระบบไฟล์อ่านอย่างเดียว · ไม่มีสิทธิ์พิเศษ · ผู้ใช้ `node`) ·
จำกัดหน่วยความจำเท่า server (api `512m` · web `384m`) และหมุน log — ดูการใช้หน่วยความจำด้วย `docker stats`

**ในเครื่องต่างจาก server** (standards ข้อ 6.1): บน server ฐานข้อมูลเป็น role ธรรมดา (ไม่ใช่ `postgres`) จึงห้ามมี `CREATE EXTENSION`
ใน migration · ไม่มีข้อมูลตัวอย่าง (seed) · ที่อยู่เว็บเป็น `https://…jowave.com` ไม่ใช่ `localhost` — โค้ดของระบบนี้ไม่สร้างที่อยู่เต็มจากคำขอ
และไม่ฝัง `localhost` (มีแค่ค่าสำรองตอนพัฒนา ซึ่ง server ตั้ง env ทับทั้งหมด)

## 5. เรื่องที่ควรรู้

- **อัปเดตเวอร์ชัน:** merge เข้า `main` → ได้ image ใหม่ → DevOps `docker compose pull && docker compose up -d` · migration รันเองตอน api เปิด
- **log** ออก stdout เป็น JSON ไม่มี token · มีรหัสผู้ใช้ของ Core Hub ซึ่งถือเป็นข้อมูลบุคคล
- **เพดานของ Core Hub:** การเช็คชื่อหนึ่งครั้งเรียก Core Hub `GET /people/me` หนึ่งครั้ง Core Hub จำกัดไว้ **600 ครั้ง / 10 วินาที ต่อ IP**
  ของเซิร์ฟเวอร์ (reference-data ข้อ 7.2) — ถ้าหลายห้องเช็คชื่อพร้อมกันจนเกิน นักศึกษาจะได้ "ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง"
  และลองใหม่ได้ในไม่กี่วินาที · ทดสอบแล้ว 300 คนกดพร้อมกันสำเร็จครบภายใน 2.4 วินาที (PR #20)
- ข้อมูลอ้างอิงจาก Core Hub (รายวิชา สาขา) cache ไว้ 10 นาทีในหน่วยความจำของ api · ข้อมูลบุคคลไม่ cache
