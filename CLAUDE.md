# Bulk Club — AI Context

Gym management system. FastAPI backend + React frontend. Three user types: gym clients (mobile), admins (desktop), and trainers (desktop).

## Running the project

```bash
# Backend (from repo root, venv activated)
uvicorn backend.main:app --reload

# Frontend
cd frontend && pnpm dev
```

Vite proxies `/api/*` → `http://localhost:8000`. Never hardcode the API base URL.

## Key architectural decisions

### Auth split
Three separate auth flows, same JWT/cookie mechanism:
- **Clients**: Google OAuth (`POST /api/auth/google`) OR DNI + password (`POST /api/auth/client/token`)
- **Admins**: username + password (`POST /api/auth/admin/token`)
- **Trainers**: same endpoint as admins (`POST /api/auth/admin/token`) — role is read from the `usuarios.role` column

JWT payload: `{ sub: user_id, role: "client"|"admin"|"trainer" }`. Stored in httpOnly cookie.

Frontend route guards (`requireClient` / `requireAdmin` / `requireTrainer` in `routes.tsx`) read `localStorage.role` for fast redirects. Real enforcement is in FastAPI deps `get_current_client` / `get_current_admin` / `get_current_trainer` in `backend/auth.py`.

**401 redirect rule**: `apiFetch` reads `localStorage.role` before clearing it:
- `admin` → `/admin/login`
- `trainer` → `/trainer/login`
- anything else → `/login`

Never use the request URL to infer the role — feed/upload endpoints are shared.

**Critical React Router v7 gotcha**: `path: '/'` matches ALL URLs as a prefix. Never put a loader on the layout route — put it on each child individually. This was a bug that caused `/admin/login` to trigger the client auth guard.

### User roles and portals
- **Clients** → `/` (mobile-first, bottom nav)
- **Admins** → `/admin` (desktop sidebar)
- **Trainers** → `/trainer` (desktop sidebar, limited: messages + feed)

The `usuarios` table holds both admins and trainers distinguished by `role` column (`'admin'` | `'trainer'`). The `/api/auth/admin/token` endpoint issues a JWT with the actual role from the DB, so both types use the same login endpoint. The frontend redirects based on the returned `role` field.

### Trainer accounts (`backend/routers/admin_entrenadores.py`)
Admins manage trainer accounts from `/admin/entrenadores`:
- Create trainer (username + password) → creates a `usuarios` row with `role='trainer'`
- Delete trainer → auto-unassigns all their clients first
- Assign/unassign clients to a trainer via `POST/DELETE /api/admin/entrenadores/{trainer_id}/clientes/{client_id}`
- Also assignable via `PUT /api/admin/clientes/{id}/trainer` with `{trainer_id: uuid|null}`

### Direct messaging (`backend/routers/messages.py` + `trainer_messages.py`)
1-to-1 between a client and their assigned trainer. Optional `rutina` JSON attachment on any message.

**Client endpoints** (`/api/messages`): get conversation, send, mark-read. Returns `{trainer, messages, unread_count}`.

**Trainer endpoints** (`/api/trainer/messages`): list all conversations (assigned clients), get/send per client, mark-read.

**Message sender_type values**: `'client'` or `'trainer'`. The `receiver_type` is always the opposite.

**Assignment**: `clientes.trainer_id` (nullable FK → `usuarios.id`). A client without a trainer sees a "no trainer assigned" placeholder. Trainers only see clients where `trainer_id == their id`.

**Polling**: frontend polls every 5 seconds (no WebSockets). Client page auto-marks read on load.

### Social feed (`backend/routers/feed.py`)
Instagram-style gym feed shared between clients, admins, and trainers. Key decisions:

- **Multi-role auth**: `get_any_user` dep in `backend/auth.py` returns `AuthorInfo`. Accepts client, admin, OR trainer JWT. Trainers are mapped to `AuthorInfo(role="admin")` so their posts are treated as staff posts.
- **Author fields are denormalized** at write time (`author_name`, `author_foto_url` stored on the post row). Old posts keep the name/photo from creation time — accepted tradeoff for query simplicity.
- **Admin/trainer posts shown first**: `list_posts` orders by `CASE WHEN author_type='admin' THEN 0 ELSE 1 END, created_at DESC` using SQLAlchemy `case()`.
- **Threaded comments**: flat DB storage with `parent_comment_id` (FK → same table, CASCADE). One level only. Client organizes into tree with `useMemo`.
- **Likes**: `post_likes` has `UniqueConstraint("post_id", "cliente_id")`. Admins/trainers cannot like (returns 403). Like count returned on each toggle.
- **Optimistic UI**: likes toggle immediately in the UI, revert on error.
- **Rate limits** (all via slowapi): upload 10/hour per user, create post 5/min, like 30/min, comment 20/min, list 60/min.
- **Upload rate-limit key**: extracted from JWT `sub` in `_upload_key()` to avoid shared-NAT collisions. Falls back to IP.
- **Orphan cleanup**: before every upload, files not referenced by any `posts.imagen_url` or `clientes.foto_url`, older than 30 min, are deleted.
- **File deletion**: `delete_upload(url)` in `backend/utils/uploads.py` — safe no-op for external URLs, path-traversal protected. Called on post delete and profile photo replacement.

### Check-in logic (`backend/routers/acceso.py`)
`POST /api/acceso/check` runs these checks in order and short-circuits on first failure:
1. 90-day inactivity → auto-disable (`habilitado = false`)
2. `habilitado == true`?
3. Has any membership?
4. `fecha_vencimiento >= today`?
5. Already checked in today?
6. Weekly day count >= `plan.dias_por_semana`? (NULL = unlimited)

**Log rules** (enforced inside `_log()`):
- `permitido` → always logged
- `denegado` → logged only if no other `denegado` entry exists for that client today (first denial per day only)
- `sin_membresia` denial → never logged (not a real member yet)

This prevents DB spam from repeated scan attempts.

**Test accounts**: clients whose DNI is in the `TEST_CLIENT_DNIS` env var (JSON list) bypass every membership rule on check-in (no daily limit, no membership needed). Their accesses are logged as `permitido` with `motivo='test'`. A test client exists in the DB: DNI `00000000`, password `00000000`.

### Physical door opening (Hikvision turnstile)
See `CONTEXT.md` for the full architecture. The backend on Render cannot reach the turnstile (private LAN), so a **local agent** (`agent/door_agent.py`, runs on a gym PC with Ethernet to the Hikvision unit) keeps an outbound WebSocket open to the backend and executes ISAPI open commands.

- **WS endpoint**: `/api/door/ws` (`backend/routers/door_agent.py`). Agent authenticates with `DOOR_AGENT_TOKEN` (Bearer header or `?token=`). One agent at a time — a new connection replaces the old.
- **Manager**: `backend/door_manager.py` singleton. `open_door()` sends `{"type":"open","request_id",...}` and awaits the agent's ack (future keyed by `request_id`, timeout `DOOR_OPEN_TIMEOUT`). Never raises.
- **Check-in hook**: in `acceso.py`, the door is opened **before** logging `permitido` — a failed open logs `denegado`/`molinete_error` instead, so the daily check-in isn't consumed and the client can retry.
- **Feature flag**: `DOOR_CONTROL_ENABLED` (default `false`). When off, check-in behaves exactly as before — required for local dev without the turnstile.
- **Admin utilities**: `GET /api/door/status` (agent connected?), `POST /api/door/open` (manual open, e2e test).
- **Agent**: shared core in `agent/molinete_core.py` (dedupes `request_id`s 5 min window, reconnects every 5 s, WS ping/pong heartbeat 20 s/10 s). Two frontends: `agent/molinete_app.py` (tkinter GUI, compiled to `Molinete.exe` via `agent/build_exe.bat`, config in `%APPDATA%\Molinete\config.json`, "start with Windows" via HKCU Run key) and `agent/door_agent.py` (headless CLI, config via `agent/.env`). See `agent/README.md`.
- **Backend env vars (Render)**: `DOOR_CONTROL_ENABLED`, `DOOR_AGENT_TOKEN`, optional `DOOR_NUMBER` (1=entrada), `DOOR_OPEN_TIMEOUT`.

### Membership status
There is no stored `activa` column on `membresias`. Active = `fecha_vencimiento >= today`, computed at query time everywhere. The `activa` field in API responses is always derived.

### Latest membership per client
`admin_clientes.py` uses a SQLAlchemy window function to get the latest membership for every client in one query:
```python
func.row_number().over(
    partition_by=Membresia.cliente_id,
    order_by=Membresia.fecha_vencimiento.desc()
)
```
Filter where `row_num == 1`. Avoids N+1 queries.

### Manual client creation
`google_id` and `email` are nullable on `clientes` to support admin-created accounts. Password defaults to the client's DNI. `habilitado` is set to `True` immediately when admin creates the account (unlike Google OAuth flow where it starts `False` and requires admin activation).

### QR check-in — two flows
The `/acceso` page supports two entry paths:
- `?qr=1` param in URL → auto-fires check-in on load (native camera scan flow)
- No param → renders `html5-qrcode` live scanner; fires check-in when it reads a URL whose pathname includes `/acceso`

The admin `/admin/qr` page generates the QR. URL is configurable and saved to `localStorage` under `checkin_qr_url`. Default: `{origin}/acceso?qr=1`.

### React StrictMode + html5-qrcode
StrictMode runs effects twice. The scanner lifecycle tracks three flags:
- `started` — set in `.then()` after `scanner.start()` resolves
- `stopped` — set when scan succeeds or component unmounts
- Cleanup only calls `scanner.stop()` if `started && !stopped` to avoid the "scanner is not running" error

The `firedRef` prevents double-firing the check-in API call if StrictMode remounts.

### Admin profile (`backend/routers/admin_me.py`)
`GET /api/admin/me` and `PUT /api/admin/me` — change username (uniqueness enforced) and profile photo. Widget lives in the `AdminLayout` sidebar.

### Trainer profile (`backend/routers/trainer_me.py`)
`GET /api/trainer/me` and `PUT /api/trainer/me` — same fields as admin profile. Widget lives in `TrainerLayout` sidebar. Uses `feedApi.uploadImage` for photo uploads.

### Client profile (`backend/routers/me.py` — `PUT /api/me/profile`)
Clients can set a bio (300 char max) and profile photo from the Dashboard. Photo uploaded via `feedApi.uploadImage`, saved via `meApi.updateProfile({ foto_url })`. Old photo deleted server-side on replacement.

## Database

PostgreSQL on Supabase. Async driver: `asyncpg`. SQLAlchemy 2.x with `mapped_column` style.

Schema is in `supabase_schema.sql`. Key tables:
- `usuarios` — admin and trainer accounts (`username`, `password_hash`, `role` ('admin'|'trainer'), `foto_url`)
- `clientes` — gym members (`google_id` nullable, `email` nullable, `password_hash` nullable, `foto_url`, `bio`, `trainer_id` nullable FK → `usuarios`)
- `planes` — plan types (`dias_por_semana` NULL = unlimited)
- `membresias` — one per client per billing period; no stored status
- `pagos` — payment records, linked to membresia optionally
- `accesos` — check-in log (`resultado`: `'permitido'` | `'denegado'`)
- `productos` — stock items
- `ventas_productos` — product sales on client tab (`pagado` boolean)
- `posts` — feed posts (`author_foto_url` denormalized, `rutina` JSON column)
- `post_likes` — unique per `(post_id, cliente_id)`
- `post_comments` — `parent_comment_id` self-FK for one-level threading, `edited_at` nullable
- `messages` — DMs between clients and trainers (`sender_id`, `sender_type` ('client'|'trainer'), `receiver_id`, `receiver_type`, `contenido`, `rutina` JSONB nullable, `read_at` nullable)

**Migrations applied manually (not in supabase_schema.sql yet):**
```sql
ALTER TABLE usuarios ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'admin';
ALTER TABLE clientes ADD COLUMN trainer_id UUID REFERENCES usuarios(id) ON DELETE SET NULL;
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL,
    sender_type VARCHAR(10) NOT NULL,
    receiver_id UUID NOT NULL,
    receiver_type VARCHAR(10) NOT NULL,
    contenido TEXT NOT NULL,
    rutina JSONB,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_messages_participants ON messages(sender_id, receiver_id);
```

`DATABASE_URL` must use `postgresql+asyncpg://` scheme (not `postgresql://`). The `database.py` module auto-converts `postgresql://` → `postgresql+asyncpg://` as a fallback.

## Backend routers

| File | Prefix | Auth |
|---|---|---|
| `auth.py` | `/api/auth` | public |
| `me.py` | `/api/me` | client |
| `acceso.py` | `/api/acceso` | client |
| `door_agent.py` | `/api/door` | WS: agent token / REST: admin |
| `feed.py` | `/api/feed` | any (client/admin/trainer) |
| `messages.py` | `/api/messages` | client |
| `trainer_messages.py` | `/api/trainer/messages` | trainer |
| `trainer_me.py` | `/api/trainer/me` | trainer |
| `admin_me.py` | `/api/admin/me` | admin |
| `admin_clientes.py` | `/api/admin/clientes` | admin |
| `admin_membresias.py` | `/api/admin/membresias` | admin |
| `admin_pagos.py` | `/api/admin/pagos` | admin |
| `admin_planes.py` | `/api/admin/planes` | admin |
| `admin_productos.py` | `/api/admin/productos` | admin |
| `admin_ventas.py` | `/api/admin/ventas` | admin |
| `admin_accesos.py` | `/api/admin/accesos` | admin |
| `admin_dashboard.py` | `/api/admin/dashboard` | admin |
| `admin_entrenadores.py` | `/api/admin/entrenadores` | admin |

## Frontend portals and routes

**Client** (`/`): Dashboard, Acceso (QR check-in), Personal (feed), Mensajes (chat with trainer)

**Admin** (`/admin`): Dashboard, Clientes, Planes, Membresías, Pagos, Stock, Ventas, Accesos, QR, Feed, Entrenadores

**Trainer** (`/trainer`): Mensajes (chat with assigned clients), Feed

Login pages: `/login` (client), `/admin/login` (admin — also works for trainer, redirects based on returned role), `/trainer/login` (trainer-only, rejects non-trainer accounts)

## Frontend conventions

- All API types and fetch functions are in `frontend/src/app/api.ts`. Add types there, not inline.
- `apiFetch` handles 401 (reads `localStorage.role` to pick redirect target, clears role), non-OK responses (throws with `detail`), and 204 (returns undefined).
- Admin list pages filter with `useMemo` on the client side. Only hit the backend for filters that change the dataset meaningfully (e.g. `pagado` on ventas, `estado` on membresias).
- Toast notifications via `sonner`. Pattern: `toast.success(...)` on success, `toast.error(e.message)` in catch.
- Forms use plain controlled state (`useState`), not react-hook-form (that dep is installed but unused).

## Passwords

bcrypt via the `bcrypt` Python package. To generate a hash for manual DB insertion:
```python
import bcrypt
print(bcrypt.hashpw(b"yourpassword", bcrypt.gensalt()).decode())
```

Admin/trainer password reset is done manually in the DB. Client password can be reset to their DNI via `POST /api/admin/clientes/{id}/reset-password`.

## Seed data

```bash
python seed_fake_data.py           # insert fake plans, clients, accesos, ventas
python seed_fake_data.py --clear   # drop everything and re-seed
```

## Phone / ngrok testing

Camera access requires HTTPS. Use ngrok to tunnel the Vite dev server:
```bash
ngrok http 5173
```
Add the resulting `https://xxx.ngrok-free.app` to:
1. Google Cloud Console → Authorized JavaScript origins
2. `.env` `ALLOWED_ORIGINS`
3. `vite.config.ts` already has `allowedHosts: true` so no Vite changes needed

The uvicorn command is always `uvicorn backend.main:app --reload` from the repo root. If you see old TechSur routes (`/productos/`, `/permutas/`) in the OpenAPI docs, you're running the wrong app — check the working directory.

## What's not implemented yet

- Individual client detail page (`/admin/clientes/:id`)
- `notas` field not exposed in the pagos create form UI
- Google OAuth requires a real `GOOGLE_CLIENT_ID` — DNI/password login works without it
- Trainer password reset (currently manual in DB only)
