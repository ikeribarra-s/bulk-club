# TechSur — Full Codebase Context

This document is for AI agents doing refactoring, feature work, or code review. It reflects the current state of the codebase. Read this before touching anything.

---

## 1. What the App Does

TechSur is an **internal management system for a second-hand electronics resale business** (primarily smartphones). Single-user (one admin account, no registration flow).

Modules:
- **Inventario** — product stock with quantity tracking per SKU
- **Compras** — purchases from suppliers or private sellers
- **Ventas** — sales to clients with multi-unit and ARS/USD support
- **Permutas** — trade-in devices received as partial payment
- **Clientes** — client records
- **Proveedores** — supplier records
- **Dashboard** — KPIs: monthly revenue (split ARS/USD), gross margin, stock levels
- **Historial** — full audit log of every write operation with one-click restore
- **Asistente IA** — Claude-powered chat for natural-language queries and operations
- **Catálogo** — public-facing product page (no auth)

---

## 2. Tech Stack

### Backend
| Concern | Tool |
|---|---|
| Framework | FastAPI |
| ORM | SQLAlchemy 2.x async (`mapped_column` style) |
| DB driver | asyncpg |
| Database | PostgreSQL on Supabase |
| Auth | JWT via httpOnly cookie (python-jose + bcrypt) |
| AI | Anthropic Python SDK (async, streaming) |
| File storage | Supabase Storage |
| Config | pydantic-settings (reads `.env`) |
| Rate limiting | slowapi |
| Runtime | uvicorn |

### Frontend
| Concern | Tool |
|---|---|
| Framework | React 18 |
| Build | Vite 6 |
| Language | TypeScript (no strict tsconfig, no `tsc` installed) |
| Routing | React Router v7 (`createBrowserRouter`) |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite`) |
| Toasts | sonner |
| Icons | lucide-react |
| Package manager | pnpm |

---

## 3. Repository Layout

```
techsur-app/
├── .env                          # Local secrets — never commit
├── .env.example
├── .gitignore
├── requirements.txt
├── runtime.txt                   # Python version pin (Heroku-style)
├── Procfile                      # Process definition (Heroku-style)
├── supabase_schema.sql           # Reference SQL for DB setup
├── README.md
├── CONTEXT.md                    # This file
├── AI_SCHEMA.md                  # AI assistant data model reference
│
├── backend/
│   ├── main.py                   # FastAPI app, CORS, router registration
│   ├── config.py                 # Pydantic Settings
│   ├── database.py               # Async engine + get_db() dependency
│   ├── auth.py                   # JWT creation + verify_token dependency
│   ├── audit.py                  # log_cambio() + snapshot() — audit log helpers
│   ├── limiter.py                # slowapi Limiter instance
│   │
│   ├── models/
│   │   ├── usuario.py
│   │   ├── producto.py           # Has `cantidad` field; `estado` derived from it
│   │   ├── producto_foto.py
│   │   ├── cliente.py
│   │   ├── proveedor.py
│   │   ├── compra.py             # Has `cantidad` field
│   │   ├── venta.py              # Has `cantidad` field; precio_final = TOTAL
│   │   ├── permuta.py
│   │   ├── enums.py              # CondicionProducto, EstadoProducto (disponible/vendido only), etc.
│   │   └── historial.py          # historial_cambios table — audit log
│   │
│   ├── schemas/
│   │   ├── producto.py           # ProductoUpdate has no `estado` field — derived only
│   │   ├── cliente.py
│   │   ├── proveedor.py
│   │   ├── compra.py
│   │   ├── venta.py
│   │   └── permuta.py
│   │
│   ├── routers/
│   │   ├── auth.py               # Rate-limited login (5/min)
│   │   ├── producto.py           # All writes call log_cambio(); estado derived from cantidad
│   │   ├── cliente.py            # All writes call log_cambio()
│   │   ├── proveedor.py          # All writes call log_cambio()
│   │   ├── compra.py             # All writes call log_cambio()
│   │   ├── venta.py              # All writes call log_cambio()
│   │   ├── permuta.py            # All writes call log_cambio()
│   │   ├── ai.py                 # /ai/chat and /ai/chat/stream — rate-limited (20/min)
│   │   └── historial.py          # GET /historial/, POST /historial/{id}/restaurar
│   │
│   └── ai_tools.py               # Tool definitions + execute_tool() for AI agent
│
└── frontend/
    ├── .env.local                # Local overrides — gitignored (VITE_API_URL for mobile only)
    ├── package.json
    ├── vite.config.ts            # Vite proxy: /auth /productos /ventas etc. → localhost:8000
    └── src/app/
        ├── api.ts                # Typed fetch client; BASE='' in local dev (proxy), VITE_API_URL for mobile
        ├── routes.tsx            # Router config + authLoader (localStorage loggedIn flag)
        ├── lib/utils.ts          # formatCurrency, formatDate, exportCSV, cn()
        ├── components/
        │   ├── Layout.tsx        # Nav with Historial link, AI chat embedded
        │   ├── AiChat.tsx        # Floating AI assistant (SSE streaming)
        │   ├── Button.tsx
        │   ├── Input.tsx         # text-base (16px) — no iOS zoom
        │   ├── Select.tsx        # text-base (16px) — no iOS zoom
        │   ├── Textarea.tsx      # text-base (16px) — no iOS zoom
        │   ├── Modal.tsx
        │   ├── StatusBadge.tsx
        │   └── ...
        └── pages/
            ├── Login.tsx
            ├── Dashboard.tsx     # ARS/USD split ingresos; margen uses cantidad
            ├── Inventario.tsx    # Button→modal pattern; Otro for marca/storage
            ├── Clientes.tsx
            ├── Ventas.tsx        # Multi-unit; precio_final = total
            ├── Compras.tsx
            ├── Proveedores.tsx
            ├── Permutas.tsx
            ├── Historial.tsx     # Audit log viewer with restore
            └── Catalogo.tsx      # Public, no auth
```

---

## 4. Stock Model (CRITICAL — read before touching inventory/ventas)

```
producto.cantidad   integer units in stock
producto.estado     derived: cantidad > 0 → "disponible", cantidad = 0 → "vendido"
```

**Rules:**
- `estado` is NEVER set manually by the user, the API client, or the AI. It is always computed from `cantidad`.
- `estado` is NOT a field in `ProductoCreate` or `ProductoUpdate` schemas — it is set by the router based on `cantidad`.
- The only valid `estado` values are `"disponible"` and `"vendido"`. `"reservado"` is removed from the enum and must not appear.
- Creating a venta: `producto.cantidad -= venta.cantidad`. If it hits 0, set `estado = "vendido"`.
- Deleting a venta: `producto.cantidad += venta.cantidad`. If it goes above 0, set `estado = "disponible"`.
- `precio_final` in ventas = **TOTAL** amount for the whole transaction (unit_price × quantity). To get unit price: `precio_final / cantidad`.
- Capital inmovilizado = `SUM(precio_compra * cantidad)` for products where `cantidad > 0`.

**Filtering for "in stock":**
```python
# Backend (correct)
q.where(Producto.cantidad > 0)   # NOT Producto.estado == "disponible"
# Frontend (correct)
productos.filter(p => p.cantidad > 0)
```

---

## 5. Audit Log (`backend/audit.py`, `backend/models/historial.py`)

Every write operation logs a `historial_cambios` entry in the **same DB transaction** as the change.

```python
from backend.audit import log_cambio, snapshot

# Pattern for UPDATE:
antes = snapshot(record)          # capture before modifying
setattr(record, field, value)
await log_cambio(db, "productos", record.id, "UPDATE", antes=antes, despues=snapshot(record))
await db.commit()

# Pattern for DELETE:
antes = snapshot(record)
await db.delete(record)
await log_cambio(db, "productos", record.id, "DELETE", antes=antes)
await db.commit()

# Pattern for CREATE:
db.add(record)
await db.flush()                  # populates record.id
await log_cambio(db, "productos", record.id, "CREATE", despues=snapshot(record))
await db.commit()
```

`snapshot()` serializes an ORM object to a plain dict (handles Decimal, UUID, date, datetime).

`fuente` values: `"manual"` (from REST routers), `"ai"` (from ai_tools.py), `"restaurar"` (from restore endpoint).

**Restore endpoint** (`POST /historial/{id}/restaurar`):
- UPDATE → re-applies `antes` fields to the current record
- DELETE → re-creates the record from `antes` (handles type coercion via `_coerce()`)
- CREATE → returns 400 (delete through normal UI)
- Restoring a deleted venta also deducts `cantidad` from the linked product again.

---

## 6. AI Assistant (`backend/routers/ai.py`, `backend/ai_tools.py`)

### Architecture
The AI runs an agentic tool-use loop against the live database (direct SQLAlchemy calls, no internal HTTP). Tools are defined in `ai_tools.py` as `TOOLS: list[dict]` (Anthropic tool schema format) and dispatched via `execute_tool(name, inputs, db)`.

### Model routing
```python
MODEL_DISPATCH = "claude-haiku-4-5-20251001"   # tool-call turns (cheap)
MODEL_DIRECT   = "claude-sonnet-4-6"            # first turn / direct answers
```
Switches to Haiku after the first tool use. Switches back to Sonnet for the final answer turn.

### Cost optimizations
- **Prompt caching**: system prompt + last tool in TOOLS list marked `cache_control: ephemeral`. Saves ~80% on those tokens after the first call in a 5-min window.
- **Sliding window**: history capped at 20 messages, always aligned to a user turn.
- **History limit**: `ChatRequest` validates max 100 messages via `field_validator`.
- **Token limits**: 512 max_tokens for tool-dispatch turns, 4096 for answer turns.
- **Result trimming**: `_trim_result()` strips `updated_at` from all tool results; strips `estado` additionally from producto results (derived field, saves tokens).
- **Client singleton**: `_get_client()` creates the `AsyncAnthropic` client once per process.
- **Rate limiting**: 20 requests/minute per IP on both `/ai/chat` and `/ai/chat/stream`.

### Streaming
`POST /ai/chat/stream` returns SSE. Events:
- `{"type": "tool_call", "tool": "<name>"}` — emitted before each tool execution
- `{"type": "text", "text": "..."}` — streamed text chunks
- `{"type": "history", "messages": [...]}` — full serialized history at the end
- `[DONE]` — stream terminator

### Key AI rules (from SYSTEM_PROMPT)
- `precio_final` is total (not per unit)
- `estado = "reservado"` does not exist — never use it
- Never read or write the `usuarios` table
- Never show `precio_compra` unless user explicitly asks for cost/margin data
- All amounts are ARS unless `moneda = "USD"`

---

## 7. Data Models

All PKs are UUID generated with `uuid.uuid4()`. All timestamps use `TIMESTAMP(timezone=True)`.

### `productos`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| nombre | String(120) | |
| marca | String(60) | default "Apple"; can be any string |
| modelo | String(80) | |
| storage | String(20) | nullable; can be any string |
| color | String(40) | nullable |
| condicion | String(20) | nuevo / usado / reacondicionado |
| bateria_salud | SmallInteger | nullable, 0–100 |
| **cantidad** | **Integer** | **units in stock — drives estado** |
| precio_compra | Numeric(12,2) | per unit |
| precio_venta | Numeric(12,2) | per unit |
| estado | String(20) | disponible / vendido — always derived from cantidad, never set via API input |
| notas | Text | nullable |
| created_at / updated_at | TIMESTAMP | |

### `ventas`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| producto_id | UUID FK → productos RESTRICT | |
| cliente_id | UUID FK → clientes SET NULL | nullable |
| **cantidad** | **Integer** | **units sold in this transaction** |
| precio_final | Numeric(12,2) | **TOTAL** amount (not per unit) |
| moneda | String(3) | ARS or USD |
| forma_pago | String(20) | efectivo / transferencia / tarjeta / mixto |
| monto_permuta | Numeric(12,2) | default 0 |
| notas | Text | nullable |
| fecha_venta | Date | |
| created_at | TIMESTAMP | |

### `compras`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| proveedor_id | UUID FK → proveedores SET NULL | nullable |
| producto_id | UUID FK → productos RESTRICT | |
| **cantidad** | **Integer** | **units purchased** |
| precio_unitario | Numeric(12,2) | per unit |
| fecha_compra | Date | |
| forma_pago | String(20) | efectivo / transferencia / tarjeta |
| notas | Text | nullable |
| created_at | TIMESTAMP | |

### `historial_cambios`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| tabla | String(50) | e.g. "productos", "ventas" |
| registro_id | String(36) | UUID of the affected record |
| operacion | String(10) | CREATE / UPDATE / DELETE |
| antes | JSONB | state before (null for CREATE) |
| despues | JSONB | state after (null for DELETE) |
| fuente | String(20) | manual / ai / restaurar |
| resumen | String(200) | human-readable summary |
| created_at | TIMESTAMP | |

Other tables (`clientes`, `proveedores`, `permutas`, `producto_fotos`, `usuarios`) are unchanged from original schema.

---

## 8. API Endpoints

Auth required on all endpoints except `GET /`, `POST /auth/token`, `POST /auth/logout`, `GET /productos/public`.

### Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/token` | Login; rate-limited 5/min |
| POST | `/auth/logout` | Clears cookie |

### AI
| Method | Path | Notes |
|---|---|---|
| POST | `/ai/chat` | Non-streaming agentic loop; rate-limited 20/min |
| POST | `/ai/chat/stream` | SSE streaming agentic loop; rate-limited 20/min |

### Historial
| Method | Path | Notes |
|---|---|---|
| GET | `/historial/` | Last 200 audit entries |
| POST | `/historial/{id}/restaurar` | Restore an UPDATE or DELETE |

### Modified behavior
| Endpoint | Behavior |
|---|---|
| `POST /ventas/` | Deducts `cantidad` from stock; derives `estado` from `cantidad` |
| `DELETE /ventas/{id}` | Restores `cantidad` to stock; derives `estado` from `cantidad` |
| `POST /productos/` | `estado` derived from `cantidad` — not accepted as input |
| `PUT /productos/{id}` | `estado` derived from `cantidad` if `cantidad` is updated — not accepted as input |
| `GET /productos/public` | Filters `cantidad > 0` |
| All write endpoints | Call `log_cambio()` before commit |

---

## 9. Frontend

### Dev proxy (local development)
All API calls use a relative BASE URL (`''`) so they go to `localhost:5173`, which Vite proxies to `localhost:8000`. This avoids cross-origin cookie issues. Configured in `vite.config.ts`.

**Do not set `VITE_API_URL` for local dev.** Only set it in `frontend/.env.local` for mobile/network access (e.g. `VITE_API_URL=http://192.168.0.2:8000`).

### URL construction
```typescript
const url = new URL(BASE + path, window.location.origin)
```
`window.location.origin` is the fallback base — required when `BASE` is `''` (empty string) since `new URL('/path')` would throw without a base.

### Auth flow
- `authLoader` in `routes.tsx` checks `localStorage.getItem('loggedIn')` to gate protected routes.
- On 401, `api.ts` removes `loggedIn` from localStorage and redirects to `/login`.
- Login sets `loggedIn` in localStorage and navigates to `/`.
- The actual session token is a `httpOnly` cookie — `loggedIn` is only a UI hint.

### Input font sizes — iOS zoom prevention
All focusable inputs must have `font-size >= 16px` or iOS Safari will auto-zoom on focus.
- Shared components (`Input`, `Select`, `Textarea`) use `text-base` (16px) ✓
- Raw inputs inline in pages use `text-[16px] md:text-sm` for mobile/desktop split

### AiChat (`components/AiChat.tsx`)
- Does NOT auto-focus the textarea when opened (would trigger mobile keyboard)
- Reads SSE `history` event to sync `apiMessages` without a second API call
- Tool call pills shown above assistant messages

### Inventario (`pages/Inventario.tsx`)
- Shows only products where `cantidad > 0`
- "Agregar Producto" button → Modal (not a tab)
- Marca and Storage selects have "Otro" option → reveals free-text input
- `marcaSelectValue()` / `storageSelectValue()` detect non-preset values and show "Otro" selected

### Dashboard (`pages/Dashboard.tsx`)
- Ingresos del mes split by currency (ARS card always shown, USD card only when > 0)
- Margen bruto = `SUM(precio_final - precio_compra * cantidad)` for ARS sales only
- `disponibles` = `productos.filter(p => p.cantidad > 0).length`

### Historial (`pages/Historial.tsx`)
- Expandable rows showing field-level diff for UPDATE, full record for CREATE/DELETE
- "Restaurar" button (UPDATE/DELETE only) → confirmation modal → `POST /historial/{id}/restaurar`
- Badges: operacion (green/yellow/red), fuente (purple=ai, gray=manual, blue=restaurar)

---

## 10. Patterns and Conventions

### Backend
- All router functions are `async`. Use `await db.flush()` before `log_cambio()` on CREATE to populate the ID without committing.
- `model_dump(exclude_unset=True)` on Update schemas gives PATCH-like behavior via PUT.
- `snapshot(orm_obj)` from `audit.py` serializes any ORM object to a JSON-safe dict.
- The `verify_token` dependency is typed `_: str = Depends(verify_token)` — result unused, only validation matters.
- `estado` is always set by routers: `"disponible" if cantidad > 0 else "vendido"`. Never trust input for this field.

### Frontend
- All API calls go through `api.get/post/put/patch/delete` from `api.ts`.
- Decimal values from API arrive as strings; use `parseDecimal()` to convert.
- Errors surfaced via `toast.error(e.message)` (sonner).
- Brand color: `#2563EB` (Tailwind `blue-600`), used as a CSS literal.
- No global state. Each page manages its own state with `useState` + `useEffect`.

---

## 11. Business Rules

1. **Stock**: `estado` is always derived from `cantidad`. Never write `estado` directly (except when syncing after a `cantidad` change in a router).
2. **Venta create**: deduct `cantidad`, set `estado = "vendido"` if 0, else `"disponible"`.
3. **Venta delete**: restore `cantidad`, set `estado = "disponible"` if > 0.
4. **precio_final**: always the TOTAL for the transaction. Unit price = `precio_final / cantidad`.
5. **Audit**: every CREATE/UPDATE/DELETE must call `log_cambio()` in the same transaction.
6. **No reservado**: the `"reservado"` estado is removed from the enum. If you see it in the DB, treat it as stale.
7. **AI restrictions**: never read/write `usuarios`; never show `precio_compra` unless user asks for cost data.
8. **Delete guards**: producto blocked if has active ventas/compras (IntegrityError); cliente blocked if has ventas; proveedor blocked if has compras.

---

## 12. Running

### Local dev
```bash
uvicorn backend.main:app --reload
cd frontend && pnpm dev
```
Do NOT set `VITE_API_URL` — the Vite proxy handles backend routing.

### Mobile (local network)
```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
cd frontend && pnpm dev --host
```
Set `VITE_API_URL=http://<machine-ip>:8000` in `frontend/.env.local`.
Add `http://<machine-ip>:5173` to `ALLOWED_ORIGINS` in `.env`.

---

## 13. Security Notes

- **Auth**: JWT in httpOnly cookie. `SameSite=lax` in dev (`COOKIE_SECURE=false`), `SameSite=none` in prod (`COOKIE_SECURE=true`). Login rate-limited 5/min.
- **AI endpoints**: Rate-limited 20/min per IP. History input capped at 100 messages via `field_validator`.
- **DB SSL**: Non-localhost connections use SSL with `CERT_NONE` — Supabase uses a self-signed CA not in the system trust store. Connection is encrypted (no plaintext). Full cert verification requires downloading Supabase's root CA.
- **`estado` invariant**: `estado` is not an input field in any schema. Always derived from `cantidad` in routers and `ai_tools.py`. `EstadoProducto.reservado` removed from the enum.
- **CORS**: Restricted to origins in `ALLOWED_ORIGINS` env var.
- **Dev proxy**: Vite proxies API routes so cookies are same-origin during local development. Without this, browsers inconsistently send cookies across `localhost` ports.

---

## 14. Known Gaps

- **No Alembic** — schema changes applied manually in Supabase SQL editor.
- **No tests** — pytest/pytest-asyncio in requirements but no test files.
- **No pagination** — all list endpoints return every row.
- **Dashboard KPIs computed client-side** from full data sets (will slow down at scale).
- **Photo deletion** removes only the DB record, not the file in Supabase Storage.
- **`venta PUT` doesn't adjust stock** — updating `cantidad` on an existing venta doesn't reconcile `producto.cantidad`.
- **No hard currency conversion** — margen bruto on Dashboard excludes USD sales (can't mix without exchange rate).
