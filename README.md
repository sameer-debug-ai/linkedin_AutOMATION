# LinkedIn Automation Tool

A full-stack automated lead generation platform built with Angular 17, Node.js/Express, MongoDB, BullMQ, Playwright, and Socket.io.

---

## 🏗 Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Angular 17 (standalone components, signals, lazy routes) |
| Styling | Tailwind CSS v3 |
| Backend | Node.js / Express / TypeScript |
| Database | MongoDB (Mongoose ODM) |
| Job Queue | BullMQ + Redis |
| Browser Automation | Playwright (Chromium) |
| Real-time | Socket.io (WebSocket) |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Redis (local or via Docker)
- npm 9+

### 1. Clone & install

```bash
# Backend
cd backend && npm install

# Frontend
cd frontend/linkedin-automation-frontend && npm install
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/linkedin-automation
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
JWT_SECRET=your-super-secret-jwt-key-here
COOKIE_ENCRYPTION_KEY=32-character-aes-key-here!!!!!
NODE_ENV=development
```

### 3. Start services

```bash
# Start Redis (via Docker)
docker run -d -p 6379:6379 redis:7-alpine

# Start MongoDB
mongod --dbpath ./data/db

# Start backend (in backend/)
npm run dev

# Start frontend (in frontend/linkedin-automation-frontend/)
npm start
```

Visit: `http://localhost:4200`

---

## 📁 Project Structure

```
linkedin-automation/
├── backend/
│   └── src/
│       ├── config/          # env, database, logger
│       ├── models/          # User, Lead, Template, ActivityLog, AutomationJob
│       ├── routes/          # auth, leads, templates, automation, analytics
│       ├── controllers/     # Request handlers
│       ├── services/        # linkedin, template, scheduler, session
│       ├── automation/      # Playwright: browser, login, search, connect, message
│       ├── queue/           # BullMQ job queue + worker
│       └── middleware/      # auth, rate-limiter, error-handler
│
└── frontend/linkedin-automation-frontend/
    └── src/app/
        ├── core/            # Services, guards, interceptors
        ├── shared/          # Sidebar, Topbar, StatCard, TruncatePipe
        └── modules/
            ├── auth/        # Login page
            ├── dashboard/   # Analytics overview
            ├── search/      # Search config + leads table
            ├── templates/   # Template list + editor modal
            ├── automation/  # Job control + live log
            └── analytics/   # Charts + performance metrics
```

---

## 🔒 Safety & Anti-Ban Measures

| Layer | Mechanism |
|-------|-----------|
| **Timing** | 30–90s random delay between each LinkedIn action |
| **Daily Cap** | Hard limit of 20–25 actions/day enforced by scheduler |
| **Working Hours** | Automation only runs 9am–6pm |
| **Human Typing** | Character-by-character typing with random delays |
| **Session Reuse** | Encrypted cookies avoid repeated logins |
| **CAPTCHA Pause** | Detected CAPTCHA pauses job and alerts via WebSocket |

---

## 🔌 API Reference

### Auth — `/api/auth`
- `POST /register` — Create account
- `POST /login` — Get JWT token
- `POST /linkedin/save-session` — Save encrypted LinkedIn cookies
- `GET /linkedin/session-status` — Check if session is active

### Leads — `/api/leads`
- `GET /` — List leads (filter, sort, paginate)
- `PATCH /:id/status` — Update lead status
- `GET /export/csv` — Download CSV

### Templates — `/api/templates`
- `GET /` / `POST /` / `PUT /:id` / `DELETE /:id`
- `POST /:id/preview` — Preview with sample data

### Automation — `/api/automation`
- `POST /start` — Enqueue new job
- `POST /pause/:jobId` / `POST /resume/:jobId` / `POST /stop/:jobId`
- `GET /jobs` — List all jobs
- `GET /daily-usage` — Today's action count vs limit

### Analytics — `/api/analytics`
- `GET /summary` — Totals + conversion rate
- `GET /daily-trend` — Last 30 days activity
- `GET /conversion-rate` — Reply % per template
- `GET /logs` — Paginated activity log

---

## ⚡ WebSocket Events (Socket.io)

| Event | Direction | Payload |
|-------|-----------|---------|
| `job:update` | Server → Client | `{ jobId, status, progress }` |
| `job:log` | Server → Client | `{ message, level }` |
| `captcha:detected` | Server → Client | `{ jobId, message }` |
| `join` | Client → Server | `userId` |

---

## 📜 License

MIT
