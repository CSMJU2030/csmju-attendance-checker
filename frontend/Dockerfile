# ---------- build stage ----------
# build context คือ "รากของ repo" เพราะ pnpm workspace เก็บ lockfile ไว้ที่ราก
#   docker build -f frontend/Dockerfile .
FROM node:22-alpine AS builder

WORKDIR /app
RUN corepack enable pnpm

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY frontend/package.json frontend/
RUN pnpm install --frozen-lockfile --filter frontend...

COPY frontend/ frontend/

# ค่าเหล่านี้ถูก "ฝัง" ตอน build:
# - BACKEND_URL ใช้ใน rewrites ของ next.config.ts (Next คำนวณ rewrites ตอน build)
# - NEXT_PUBLIC_* ถูกแทนค่าลงใน bundle ของเบราว์เซอร์
# เปลี่ยนค่าต้อง build image ใหม่ (docker compose build)
ARG BACKEND_URL=http://attendance-checker-api:3002
ARG NEXT_PUBLIC_CORE_HUB_PORTAL_URL=http://localhost:3100
ARG NEXT_PUBLIC_SUBSYSTEM_NAME=csmju-attendance-checker
ENV BACKEND_URL=$BACKEND_URL \
    NEXT_PUBLIC_CORE_HUB_PORTAL_URL=$NEXT_PUBLIC_CORE_HUB_PORTAL_URL \
    NEXT_PUBLIC_SUBSYSTEM_NAME=$NEXT_PUBLIC_SUBSYSTEM_NAME \
    NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter frontend build

# ---------- runtime stage ----------
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3102 \
    HOSTNAME=0.0.0.0

# standalone = server.js + เฉพาะ node_modules ที่ใช้จริง (ไม่ต้อง pnpm install ซ้ำ)
COPY --from=builder --chown=node:node /app/frontend/.next/standalone ./
COPY --from=builder --chown=node:node /app/frontend/.next/static ./frontend/.next/static

USER node
EXPOSE 3102

CMD ["node", "frontend/server.js"]
