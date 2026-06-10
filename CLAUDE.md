# Bulk Club — AI Context

Gym management system for a real gym going to production. FastAPI backend (deployed on Render) + React frontend + a local Windows agent ("Molinete") that physically opens a Hikvision turnstile. Three user types: gym clients (mobile), admins (desktop), and trainers (desktop).

## System overview

```
[Client phone]  ──QR scan──►  [React frontend (Vite)]
                                    │ /api/*
                                    ▼
                              [FastAPI backend]  ◄──WebSocket──  [Molinete.exe — gym PC]
                                    │                                  │ ISAPI (HTTP Digest)
                              [Supabase Postgres]                      ▼
                                                          [Hikvision DS-K3M230 turnstile
                                                           @ 192.168.1.202]
```

The backend cannot reach the turnstile (private LAN), so the agent keeps an *outbound* WebSocket open to the backend and executes door-open commands locally. No router ports are opened. Full protocol spec in `CONTEXT.md` and `agent/README.md`.

## Repository layout

- `backend/` — FastAPI app (`main.py`, `auth.py`, `config.py`, `database.py`, `door_manager.py`, `limiter.py`, `models/`, `schemas/`, `routers/`, `utils/`)
- `frontend/` — React 19 + Vite + TS. All pages under `src/app/pages/{client,admin,trainer}/`, shared layouts in `src/app/components/`, all API calls in `src/app/api.ts`, routing in `src/app/routes.tsx`
- `agent/` — the local turnstile agent (see "Physical door opening" below)
- `supabase_schema.sql` — DB schema (kept up to date with applied migrations)
- `CONTEXT.md` — door-control architecture and Hikvision ISAPI reference
- `techsur/` — unrelated legacy project, ignore it

## Running the project

```bash
# Backend (from repo root, venv activated)
uvicorn backend.main:app --reload
# add --host 0.0.0.0 if another machine on the LAN must reach it (e.g. Molinete agent testing)

# Frontend
cd frontend && pnpm dev

# Local agent (console version, dev)
python agent/door_agent.py
```

Vite proxies `/api/*` → `http://localhost:8000`. Never hardcode the API base URL.

## Environment variables (backend `.env`)

| Var | Notes |
|---|---|
| `DATABASE_URL` | Supabase Postgres. Must be `postgresql+asyncpg://` (auto-converted from `postgresql://` as fallback) |
| `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT signing |
| `ALLOWED_ORIGINS` | JSON list, CORS |
| `COOKIE_SECURE` | `true` in production (HTTPS) |
| `GOOGLE_CLIENT_ID` | Google OAuth for clients; DNI/password login works without it |
| `DOOR_CONTROL_ENABLED` | default `false`. When off, check-in never contacts the agent (required for dev without turnstile) |
| `DOOR_AGENT_TOKEN` | shared secret for the agent WebSocket. Empty = all agent connections rejected |
| `DOOR_NUMBER` | `1` = entrance (default), `2` = exit |
| `DOOR_OPEN_TIMEOUT` | seconds to wait for the agent's ack (default 5) |
| `TEST_CLIENT_DNIS` | JSON list of DNIs that bypass all check-in rules (see Test accounts) |

`pydantic-settings` loads these once at startup — **uvicorn `--reload` does NOT re-read `.env`**; restart the process after changing it.

## Key architectural decisions

### Auth split
Three separate auth flows, same JWT/cookie mechanism:
- **Clients**: Google OAuth (`POST /api/auth/google`) OR DNI + password (`POST /api/auth/client/token`)
- **Admins**: username + password (`POST /api/auth/admin/token`)
- **Trainers**: same endpoint as admins (`POST /api/auth/admin/token`) — role is read from the `usuarios.role` column

JWT payload: `{ sub: user_id, role: "client"|"admin"|"trainer" }`. Stored in httpOnly cookie named `token`.

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
7. Physical door open (only if `DOOR_CONTROL_ENABLED` — see below)

**Log rules** (enforced inside `_log()`):
- `permitido` → always logged
- `denegado` → logged only if no other `denegado` entry exists for that client today (first denial per day only)
- `sin_membresia` denial → never logged (not a real member yet)

This prevents DB spam from repeated scan attempts.

**Test accounts**: clients whose DNI is in the `TEST_CLIENT_DNIS` env var bypass every membership rule on check-in (no daily limit, no membership needed) — but the door still opens for real. Their accesses are logged as `permitido` with `motivo='test'`. A test client exists in the DB: DNI `00000000`, password `00000000`, with a never-expiring "Test (ilimitado)" membership (plan has `activo=false` so it's hidden from real plan options). **Remove/disable this account or the env var before real launch.**

### Physical door opening (Hikvision turnstile)
See `CONTEXT.md` for the full architecture and ISAPI command reference.

- **WS endpoint**: `/api/door/ws` (`backend/routers/door_agent.py`). Agent authenticates with `DOOR_AGENT_TOKEN` (Bearer header or `?token=`), compared with `secrets.compare_digest`. One agent at a time — a new connection replaces the old (close code 1012). **Never run two agents against the same backend: they kick each other in a loop.**
- **Manager**: `backend/door_manager.py` singleton. `open_door()` sends `{"type":"open","request_id","door"}` and awaits the agent's `{"type":"ack","request_id","ok","error"}` (future keyed by `request_id`, timeout `DOOR_OPEN_TIMEOUT`). Returns `(ok, error)`, never raises. `agente_desconectado` when no agent.
- **Check-in hook**: the door is opened **before** logging `permitido` — a failed open logs `denegado`/`molinete_error` instead, so the daily check-in isn't consumed and the client can retry.
- **Admin utilities**: `GET /api/door/status` (enabled? agent connected?), `POST /api/door/open` (manual open — end-to-end test without scanning).
- **Agent** (`agent/` folder):
  - `molinete_core.py` — shared logic: `AgentConfig` dataclass, `abrir_molinete()` (ISAPI PUT with Digest auth), `DoorAgent` (connect/reconnect every 5 s, WS ping/pong heartbeat 20 s/10 s, `request_id` dedup window 5 min, `mock` mode that simulates openings).
  - `molinete_app.py` — tkinter GUI, compiled to **`Molinete.exe`** via `agent/build_exe.bat` (PyInstaller onefile/windowed). Config in `%APPDATA%\Molinete\config.json`, log in `%APPDATA%\Molinete\molinete.log`. Features: status indicator, config form, "Probar apertura" (direct ISAPI test), "Iniciar con Windows" (HKCU Run key). Auto-connects on launch if config is valid; if validation fails it shows a dialog and stays in "Detenido".
  - `door_agent.py` — headless CLI version, config via `agent/.env` (see `.env.example`).
- **Turnstile**: Hikvision DS-K3M230 @ `192.168.1.202`, HTTP Digest auth. Door 1 = entrance, door 2 = exit. Use an operator user (door-control permission only), not the device admin.
- **Token debugging**: a 403 on the WS handshake = token mismatch (or empty server token). The token field in the GUI is masked — when in doubt, write `%APPDATA%\Molinete\config.json` directly and restart the app (editing it while the app runs gets overwritten by "Guardar y reconectar").
- **Render free tier caveat**: the service spins down on idle, killing the agent's WebSocket. The agent reconnects ~5 s after wake, but the first scan after a cold start may fail with `molinete_error` and need a retry.

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
- `accesos` — check-in log (`resultado`: `'permitido'` | `'denegado'`; `motivo` constrained by `accesos_motivo_check` to: `cuota_vencida`, `ya_ingreso_hoy`, `plan_agotado`, `cuenta_deshabilitada`, `sin_membresia`, `molinete_error`, `test` — **adding a new motivo requires altering that constraint**)
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
(The `accesos_motivo_check` extension with `molinete_error`/`test` was applied manually AND is reflected in `supabase_schema.sql`.)

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

**Client** (`/`): Dashboard, Acceso (QR check-in), Personal (feed), Mensajes (chat with trainer), Onboarding, Login

**Admin** (`/admin`): Dashboard, Clientes, Planes, Membresías, Pagos, Stock, Ventas, Accesos, QR, Personal (feed), Mensajes, Entrenadores

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

## Testing on other devices

**Phone (camera needs HTTPS)** — ngrok tunnel to Vite:
```bash
ngrok http 5173
```
Add the resulting `https://xxx.ngrok-free.app` to:
1. Google Cloud Console → Authorized JavaScript origins
2. `.env` `ALLOWED_ORIGINS`
3. `vite.config.ts` already has `allowedHosts: true` so no Vite changes needed

**Another PC on the LAN (e.g. Molinete agent)** — run uvicorn with `--host 0.0.0.0`, allow TCP 8000 in Windows Firewall (private networks), and point the agent at `ws://<this-pc-lan-ip>:8000/api/door/ws`. Verify reachability with `http://<ip>:8000` in a browser first.

The uvicorn command is always `uvicorn backend.main:app --reload` from the repo root. If you see old TechSur routes (`/productos/`, `/permutas/`) in the OpenAPI docs, you're running the wrong app — check the working directory.

## Production deployment (Render)

- Backend deploys to Render; `uvicorn[standard]` already includes WebSocket support.
- Required env vars on Render: everything in the table above; specifically set `DOOR_CONTROL_ENABLED=true`, a strong `DOOR_AGENT_TOKEN` (same value configured in Molinete on the gym PC), `COOKIE_SECURE=true`, and production `ALLOWED_ORIGINS`.
- Molinete config on the gym PC then points at `wss://<app>.onrender.com/api/door/ws` (wss, not ws).
- Pre-launch checklist: remove `TEST_CLIENT_DNIS` (or the test client), create an operator user on the turnstile (stop using the device admin), confirm door 1 vs 2 direction.

## What's not implemented yet

- Individual client detail page (`/admin/clientes/:id`)
- `notas` field not exposed in the pagos create form UI
- Google OAuth requires a real `GOOGLE_CLIENT_ID` — DNI/password login works without it
- Trainer password reset (currently manual in DB only)
- Turnstile "access granted" beep (planned: buzzer on the agent — out of scope for now, see CONTEXT.md)
