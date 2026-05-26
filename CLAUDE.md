# Bulk Club — AI Context

Gym management system. FastAPI backend + React frontend. Two distinct user types: gym clients (mobile) and admins (desktop).

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
Two completely separate auth flows, same JWT/cookie mechanism:
- **Clients**: Google OAuth (`POST /api/auth/google`) OR DNI + password (`POST /api/auth/client/token`)
- **Admins**: username + password (`POST /api/auth/admin/token`)

JWT payload: `{ sub: user_id, role: "client"|"admin" }`. Stored in httpOnly cookie.

Frontend route guards (`requireClient` / `requireAdmin` in `routes.tsx`) read `localStorage.role` for fast redirects. Real enforcement is in FastAPI deps `get_current_client` / `get_current_admin` in `backend/auth.py`.

**401 redirect rule**: `apiFetch` reads `localStorage.role` before clearing it to decide whether to send to `/login` or `/admin/login`. Never use the request URL to infer the role — feed/upload endpoints are shared and don't contain `/admin/`.

**Critical React Router v7 gotcha**: `path: '/'` matches ALL URLs as a prefix. Never put a loader on the layout route — put it on each child individually. This was a bug that caused `/admin/login` to trigger the client auth guard.

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

### Social feed (`backend/routers/feed.py`)
Instagram-style gym feed shared between clients and admins. Key decisions:

- **Dual-role auth**: `get_any_user` dep in `backend/auth.py` returns `AuthorInfo` dataclass (`id`, `role`, `display_name`, `foto_url`). Accepts either client or admin JWT.
- **Author fields are denormalized** at write time (`author_name`, `author_foto_url` stored on the post row). Old posts keep the name/photo from when they were created — accepted tradeoff for query simplicity.
- **Admin posts shown first**: `list_posts` orders by `CASE WHEN author_type='admin' THEN 0 ELSE 1 END, created_at DESC` using SQLAlchemy `case()`.
- **Threaded comments**: flat DB storage with `parent_comment_id` (FK → same table, CASCADE). One level only. Client organizes into tree with `useMemo`.
- **Likes**: `post_likes` has `UniqueConstraint("post_id", "cliente_id")`. Admins cannot like (returns 403). Like count returned on each toggle.
- **Optimistic UI**: likes toggle immediately in the UI, revert on error.
- **Rate limits** (all via slowapi): upload 10/hour per user, create post 5/min, like 30/min, comment 20/min, list 60/min.
- **Upload rate-limit key**: extracted from JWT `sub` in `_upload_key()` to avoid shared-NAT collisions. Falls back to IP.
- **Orphan cleanup**: before every upload, files not referenced by any `posts.imagen_url` or `clientes.foto_url`, older than 30 min, are deleted.
- **File deletion**: `delete_upload(url)` in `backend/utils/uploads.py` — safe no-op for external URLs, path-traversal protected. Called on post delete and profile photo replacement.

### Admin profile (`backend/routers/admin_me.py`)
`GET /api/admin/me` and `PUT /api/admin/me` — change username (uniqueness enforced) and profile photo. Widget lives in the `AdminLayout` sidebar. Uses the same `feedApi.uploadImage` as the client for photo uploads.

### Client profile (`backend/routers/me.py` — `PUT /api/me/profile`)
Clients can set a bio (300 char max) and profile photo from the Dashboard. Photo uploaded via `feedApi.uploadImage`, saved via `meApi.updateProfile({ foto_url })`. Old photo deleted server-side on replacement.

## Database

PostgreSQL on Supabase. Async driver: `asyncpg`. SQLAlchemy 2.x with `mapped_column` style.

Schema is in `supabase_schema.sql`. Key tables:
- `usuarios` — admin accounts (`username`, `password_hash`, `foto_url`)
- `clientes` — gym members (`google_id` nullable, `email` nullable, `password_hash` nullable, `foto_url`, `bio`)
- `planes` — plan types (`dias_por_semana` NULL = unlimited)
- `membresias` — one per client per billing period; no stored status
- `pagos` — payment records, linked to membresia optionally
- `accesos` — check-in log (`resultado`: `'permitido'` | `'denegado'`)
- `productos` — stock items
- `ventas_productos` — product sales on client tab (`pagado` boolean)
- `posts` — feed posts (`author_foto_url` denormalized, `rutina` JSON column)
- `post_likes` — unique per `(post_id, cliente_id)`
- `post_comments` — `parent_comment_id` self-FK for one-level threading, `edited_at` nullable

`DATABASE_URL` must use `postgresql+asyncpg://` scheme (not `postgresql://`).

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

Admin password reset is done manually in the DB. Client password can be reset to their DNI via `POST /api/admin/clientes/{id}/reset-password`.

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
