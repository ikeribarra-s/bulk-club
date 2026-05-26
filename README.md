# Bulk Club — Gym Management System

Web app for managing a gym: member check-ins, memberships, payments, product sales, and a social feed. Two portals — a mobile-first client portal and a desktop admin panel — served from a single React app.

## Features

**Client portal (mobile)**
- Instagram-style profile: photo, bio, post grid, stats
- Membership status card and tab balance (unpaid product charges)
- Social feed: post text, images, or structured workout routines; like and comment
- QR check-in: scan the gym entrance code or show yours to be scanned
- Recent check-in history

**Admin panel (desktop)**
- Dashboard: active members, today's check-ins, expiring memberships, low stock
- Client management — create, enable/disable, assign/renew memberships, reset passwords
- Plans, memberships, payments, stock, product sales
- Check-in log with filtering
- QR code generator for the gym entrance
- Social feed — post news, workout routines, and updates
- Admin profile — change username and photo from the sidebar

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (Python), async SQLAlchemy 2.x, asyncpg |
| Database | PostgreSQL via Supabase |
| Auth | JWT in httpOnly cookies; Google OAuth for clients, username/password for admins |
| Frontend | React 19, React Router v7, TypeScript, Tailwind CSS v4, Vite |
| Rate limiting | slowapi |

---

## Local Setup

### Prerequisites
- Python 3.11+
- Node.js 20+ with pnpm
- A Supabase project (free tier works)

### 1. Database

Run `supabase_schema.sql` in the Supabase SQL editor to create all tables and apply migrations.

### 2. Backend

```bash
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

pip install -r requirements.txt

cp .env.example .env
# Fill in .env (see below)

uvicorn backend.main:app --reload
# API at http://localhost:8000
```

**.env values:**

```env
DATABASE_URL=postgresql+asyncpg://postgres:PASSWORD@db.XXXX.supabase.co:5432/postgres
SECRET_KEY=any-long-random-string
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
ALLOWED_ORIGINS=["http://localhost:5173"]
COOKIE_SECURE=false
```

> `DATABASE_URL` must use `postgresql+asyncpg://` — not `postgresql://`.

### 3. Frontend

```bash
cd frontend
pnpm install
pnpm dev
# App at http://localhost:5173
```

Vite proxies `/api/*` to `http://localhost:8000`.

### 4. Create the first admin

No registration UI by design. Insert directly in Supabase:

```python
# Generate a password hash:
import bcrypt
print(bcrypt.hashpw(b"your-password", bcrypt.gensalt()).decode())
```

```sql
INSERT INTO usuarios (username, password_hash) VALUES ('admin', '$2b$12$...');
```

### 5. Seed fake data (optional)

```bash
python seed_fake_data.py          # creates plans, clients, accesos, ventas
python seed_fake_data.py --clear  # wipes and re-seeds
```

---

## Testing on a Phone

The QR scanner and camera upload require HTTPS. Use [ngrok](https://ngrok.com):

```bash
ngrok http 5173
# → https://abc123.ngrok-free.app
```

Then:
1. Add the URL to **Authorized JavaScript origins** in Google Cloud Console → APIs & Services → Credentials.
2. Add it to `.env`: `ALLOWED_ORIGINS=["http://localhost:5173","https://abc123.ngrok-free.app"]` and restart uvicorn.
3. Open the URL on your phone.

> The ngrok URL changes each restart (free plan). Update Google Cloud Console and `.env` accordingly.

---

## Architecture

### Two Portals, One App

```
Client portal (mobile-first)      Admin portal (desktop)
/login                             /admin/login
/onboarding                        /admin
/                   (profile)      /admin/clientes
/personal           (feed)         /admin/membresias
/acceso             (QR scanner)   /admin/pagos
                                   /admin/planes
                                   /admin/stock
                                   /admin/ventas
                                   /admin/accesos
                                   /admin/qr
                                   /admin/personal  (feed)
```

### Client Check-In Flow

The QR at the gym encodes `https://your-domain.com/acceso?qr=1`. Two paths:

- **In-app scanner**: client taps "Ingresar" → live camera → scans QR → check-in fires.
- **Native camera**: phone opens the URL → `?qr=1` triggers auto-fire on load.

`POST /api/acceso/check` runs in order:
1. 90-day inactivity → auto-disable account
2. Account enabled?
3. Has a membership?
4. Membership not expired?
5. Already checked in today?
6. Hit the weekly day limit for their plan?

Log rules: permitted → always logged. First denial of the day → logged. Repeated denials → silently ignored. No-membership denials → never logged.

### Social Feed

Instagram-style feed shared between clients and admins:
- Posts can contain text, an image, or a structured workout routine
- Admins' posts always appear first (`ORDER BY author_type = 'admin' DESC, created_at DESC`)
- Author name and photo are denormalized at write time (old posts keep the photo from when they were created)
- Threaded comments (one level), likes (clients only), edit own comments
- Upload rate-limited per user (10 images/hour); orphan files cleaned up on each upload

### Auth

- **Clients**: Google OAuth or DNI + password (for admin-created accounts)
- **Admins**: username + password at `/admin/login`
- JWT stored in httpOnly cookie, payload: `{ sub: user_id, role: "client"|"admin" }`
- Route guards in `routes.tsx` read `localStorage.role` for fast redirects; server enforces via `get_current_client` / `get_current_admin` deps
- On 401, `apiFetch` reads `localStorage.role` to redirect to the correct login page (admin vs client)

---

## Project Structure

```
bulk-club/
├── backend/
│   ├── main.py
│   ├── auth.py               # JWT, get_current_*, AuthorInfo (dual-role)
│   ├── models/               # SQLAlchemy models
│   │   ├── usuario.py        # admin accounts (username, password_hash, foto_url)
│   │   ├── cliente.py        # gym members (foto_url, bio)
│   │   ├── post.py           # feed posts (author_foto_url denormalized)
│   │   ├── post_like.py
│   │   ├── post_comment.py   # parent_comment_id for threading
│   │   └── ...
│   ├── routers/
│   │   ├── feed.py           # feed, upload, likes, comments
│   │   ├── me.py             # client self-service + profile
│   │   ├── admin_me.py       # admin profile (username, photo)
│   │   ├── acceso.py         # check-in logic
│   │   └── admin_*.py
│   ├── schemas/
│   └── utils/uploads.py      # UPLOAD_DIR, delete_upload()
├── frontend/
│   └── src/app/
│       ├── api.ts            # all API types + fetch wrappers
│       ├── routes.tsx        # route tree with auth guards
│       ├── components/
│       │   ├── Feed.tsx      # full feed UI (posts, comments, likes)
│       │   ├── AdminLayout.tsx
│       │   └── ClientLayout.tsx
│       └── pages/
│           ├── client/       # Dashboard, Personal (feed), Acceso, Onboarding
│           └── admin/        # one file per admin page
├── uploads/                  # local image storage (gitignored)
├── supabase_schema.sql       # full schema + all ALTER TABLE migrations
├── seed_fake_data.py
├── requirements.txt
└── .env.example
```

---

## Production

- Set `COOKIE_SECURE=true` and serve over HTTPS
- Set `ALLOWED_ORIGINS` to your production domain
- Build frontend: `cd frontend && pnpm build` → output in `frontend/dist`
- Serve `frontend/dist` as static files; point `/api/*` to the FastAPI server
