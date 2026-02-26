# 🤖 LLM Platform — Enterprise Chat

ระบบแชท LLM ภายในองค์กร รองรับ Claude, GPT, Gemini และ Ollama (local)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│                   Nginx (80/443)            │
│          Reverse Proxy + Rate Limit         │
└──────────┬──────────────────┬───────────────┘
           │                  │
    ┌──────▼──────┐    ┌──────▼──────┐
    │  Next.js    │    │   NestJS    │
    │  Frontend   │    │   Backend   │
    │  :3000      │    │   :4000     │
    └─────────────┘    └──────┬──────┘
                              │
              ┌───────────────┼────────────────┐
              │               │                │
        ┌─────▼─────┐  ┌─────▼──────┐  ┌──────▼──────┐
        │  MongoDB  │  │   Redis    │  │  AI APIs    │
        │  :27017   │  │   :6379    │  │ Claude/GPT/ │
        └───────────┘  └────────────┘  │ Gemini/Ollama│
                                        └─────────────┘
```

## ✅ Features

| Feature | Details |
|---|---|
| **Multi-model** | Claude (Opus/Sonnet/Haiku), GPT (4o/4o-mini/4-turbo), Gemini (2.0 Flash/1.5 Pro/Flash), Ollama (local) |
| **Streaming** | Server-Sent Events (SSE) — token-by-token real-time |
| **Chat History** | ประวัติการสนทนา, pin, archive, ค้นหา |
| **System Prompt** | กำหนด system prompt ต่อ conversation |
| **User Management** | register/login, role: admin/user |
| **Cost Tracking** | token usage + ราคาต่อ model ต่อ user |
| **Token Limits** | Admin กำหนด limit per user ได้ |
| **Admin Dashboard** | stats, user management, cost by model, usage chart |
| **Rate Limiting** | throttle ทั้ง nginx + NestJS level |
| **JWT Auth** | access token + refresh token |
| **CORS** | กำหนด allowed origins |
| **Docker Ready** | docker-compose ครบ |

---

## 🚀 Quick Start

```bash
# 1. Clone และเข้าไปในโฟลเดอร์
cd llm-platform

# 2. สร้างไฟล์ .env
cp .env.example .env

# 3. แก้ไข .env (สำคัญมาก!)
nano .env
```

**.env ที่ต้องแก้ไข:**
```env
# AI Keys (ใส่อย่างน้อย 1 ตัว)
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-...
GOOGLE_GENERATIVE_AI_API_KEY=AIza...

# Security (ต้องเปลี่ยนก่อน deploy!)
JWT_SECRET=your-very-long-random-secret-min-64-characters
REDIS_PASSWORD=your-redis-password

# Admin account แรก
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD=your-secure-password

# Frontend domain
ALLOWED_ORIGINS=https://chat.yourcompany.com
```

```bash
# 4. รัน
docker compose up -d

# ดู logs
docker compose logs -f
```

เปิด http://localhost แล้วสมัครสมาชิกด้วย ADMIN_EMAIL ได้เลย

---

## 📁 Project Structure

```
llm-platform/
├── backend/                    # NestJS API
│   └── src/
│       ├── auth/               # JWT auth, register, login
│       ├── chat/               # Conversations, messages, streaming
│       ├── models/             # LLM provider abstraction
│       ├── admin/              # User management, stats
│       └── common/             # Mongoose schemas
│
├── frontend/                   # Next.js App Router
│   └── app/
│       ├── chat/page.tsx       # Main chat UI
│       ├── login/page.tsx      # Auth page
│       ├── admin/page.tsx      # Admin dashboard
│       └── layout.tsx
│
├── docker/
│   └── nginx.conf              # Reverse proxy config
│
├── docker-compose.yml
└── .env.example
```

---

## 🔌 API Reference

### Auth
```
POST /api/auth/register  { email, password, name }
POST /api/auth/login     { email, password }
POST /api/auth/refresh   { refreshToken }
POST /api/auth/logout
```

### Chat (requires Bearer token)
```
GET    /api/chat/conversations
POST   /api/chat/conversations        { model, provider, systemPrompt }
PATCH  /api/chat/conversations/:id    { title, systemPrompt, isPinned }
DELETE /api/chat/conversations/:id

GET    /api/chat/conversations/:id/messages
POST   /api/chat/conversations/:id/stream  { message }  → SSE stream

GET    /api/chat/stats
```

### Admin (requires admin role)
```
GET    /api/admin/users
PATCH  /api/admin/users/:id   { isActive, role, tokenLimit }
DELETE /api/admin/users/:id
GET    /api/admin/stats
GET    /api/admin/usage        # daily usage 30 วัน
```

---

## 💸 Pricing Reference (USD per 1M tokens)

| Model | Input | Output |
|---|---|---|
| Claude Sonnet 4 | $3.00 | $15.00 |
| Claude Opus 4 | $15.00 | $75.00 |
| Claude Haiku 4.5 | $0.80 | $4.00 |
| GPT-4o | $2.50 | $10.00 |
| GPT-4o Mini | $0.15 | $0.60 |
| Gemini 2.0 Flash | $0.10 | $0.40 |
| Gemini 1.5 Pro | $1.25 | $3.75 |
| Ollama (local) | $0 | $0 |

---

## 🔒 Production Checklist

- [ ] เปลี่ยน `JWT_SECRET` เป็น random string ยาวๆ
- [ ] เปลี่ยน `REDIS_PASSWORD`
- [ ] เปลี่ยน `ADMIN_PASSWORD`
- [ ] เพิ่ม SSL certificate ใน `docker/certs/`
- [ ] Uncomment HTTPS block ใน `nginx.conf`
- [ ] ตั้ง `ALLOWED_ORIGINS` ให้ตรง domain จริง
- [ ] Setup MongoDB backup (mongodump cron)
- [ ] Monitor ด้วย Grafana + Prometheus (optional)

---

## 🛠️ Development

```bash
# Backend
cd backend && npm install && npm run start:dev

# Frontend
cd frontend && npm install && npm run dev
```

---

## ➕ เพิ่ม Model ใหม่

แก้ไข `backend/src/models/models.service.ts`:

1. เพิ่มใน `AVAILABLE_MODELS` array
2. เพิ่ม pricing ใน `PRICING` object
3. เพิ่ม case ใน `streamChat()` switch

---

## 📞 Support

ต้องการเพิ่ม feature เช่น RAG, Plugin, SSO (LDAP/OAuth) → พัฒนาต่อได้บน codebase นี้ได้เลย
