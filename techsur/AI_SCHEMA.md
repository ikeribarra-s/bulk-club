# TechSur AI Assistant — Database & Access Schema

This document defines the data model the AI assistant operates on,
what it can read, what it can write, what it can delete, and what
bulk operations it can execute.
It is the single source of truth used to build the assistant's system prompt and tool definitions.

---

## 1. Business Context

TechSur is a second-hand electronics commerce (primarily smartphones).
Operations involve buying devices from suppliers or customers (permutas),
stocking them as inventory, and selling them to end customers.
The AI assistant helps the owner manage inventory, sales, and finances
through natural-language queries and guided actions — including bulk data
entry (loading batches of stock) and removal of incorrect or duplicate records.

---

## 2. Database Tables

### 2.1 `productos` — Inventory

The central table. Every physical device in stock or already sold.

| Column         | Type              | Nullable | Description |
|----------------|-------------------|----------|-------------|
| id             | UUID (PK)         | NO       | Auto-generated |
| nombre         | VARCHAR(120)      | NO       | Display name, e.g. "iPhone 13 Pro 256GB Azul" |
| marca          | VARCHAR(60)       | NO       | Brand — default "Apple" |
| modelo         | VARCHAR(80)       | NO       | Model name, e.g. "iPhone 13 Pro" |
| storage        | VARCHAR(20)       | YES      | Storage capacity, e.g. "256GB" |
| color          | VARCHAR(40)       | YES      | Color label |
| condicion      | VARCHAR(20)       | NO       | Enum: nuevo / usado / reacondicionado |
| bateria_salud  | SMALLINT          | YES      | Battery health % (0–100), relevant for used devices |
| cantidad       | INTEGER           | NO       | Units in stock. Drives estado automatically |
| precio_compra  | NUMERIC(12,2)     | NO       | What TechSur paid for it (per unit) |
| precio_venta   | NUMERIC(12,2)     | NO       | Listed sale price (per unit) |
| estado         | VARCHAR(20)       | NO       | Enum: disponible / vendido — set automatically: cantidad > 0 → disponible, cantidad = 0 → vendido. Never set manually. |
| notas          | TEXT              | YES      | Free-form internal notes |
| created_at     | TIMESTAMPTZ       | NO       | Record creation time |
| updated_at     | TIMESTAMPTZ       | NO       | Last update time |

**Computed fields the AI should derive:**
- `margen_bruto = precio_venta - precio_compra`
- `margen_porcentual = (precio_venta - precio_compra) / precio_compra * 100`

---

### 2.2 `producto_fotos` — Product Photos

| Column      | Type          | Nullable | Description |
|-------------|---------------|----------|-------------|
| id          | UUID (PK)     | NO       | Auto-generated |
| producto_id | UUID (FK)     | NO       | References productos.id (CASCADE DELETE) |
| url         | VARCHAR(1000) | NO       | Public URL of the image |
| orden       | INTEGER       | NO       | Display order (ascending) |
| created_at  | TIMESTAMPTZ   | NO       | Upload time |

---

### 2.3 `clientes` — Customers

| Column    | Type          | Nullable | Description |
|-----------|---------------|----------|-------------|
| id        | UUID (PK)     | NO       | Auto-generated |
| nombre    | VARCHAR(80)   | NO       | First name |
| apellido  | VARCHAR(80)   | YES      | Last name |
| dni       | VARCHAR(20)   | YES      | National ID |
| telefono  | VARCHAR(40)   | YES      | Phone number |
| email     | VARCHAR(120)  | YES      | Email address |
| direccion | TEXT          | YES      | Postal address |
| notas     | TEXT          | YES      | Internal notes |
| created_at| TIMESTAMPTZ   | NO       | Record creation time |
| updated_at| TIMESTAMPTZ   | NO       | Last update time |

---

### 2.4 `proveedores` — Suppliers

| Column   | Type          | Nullable | Description |
|----------|---------------|----------|-------------|
| id       | UUID (PK)     | NO       | Auto-generated |
| nombre   | VARCHAR(100)  | NO       | Supplier name or company |
| contacto | VARCHAR(100)  | YES      | Contact person name |
| telefono | VARCHAR(40)   | YES      | Phone number |
| email    | VARCHAR(120)  | YES      | Email address |
| notas    | TEXT          | YES      | Internal notes |
| created_at| TIMESTAMPTZ  | NO       | Record creation time |
| updated_at| TIMESTAMPTZ  | NO       | Last update time |

---

### 2.5 `compras` — Purchase Records

Tracks every device TechSur acquires (from a supplier or privately).

| Column         | Type          | Nullable | Description |
|----------------|---------------|----------|-------------|
| id             | UUID (PK)     | NO       | Auto-generated |
| proveedor_id   | UUID (FK)     | YES      | References proveedores.id (SET NULL on delete) |
| producto_id    | UUID (FK)     | NO       | References productos.id (RESTRICT delete) |
| cantidad       | INTEGER       | NO       | Units purchased |
| precio_unitario| NUMERIC(12,2) | NO       | Price paid per unit |
| fecha_compra   | DATE          | NO       | Date of purchase |
| forma_pago     | VARCHAR(20)   | NO       | Enum: efectivo / transferencia / tarjeta |
| notas          | TEXT          | YES      | Internal notes |
| created_at     | TIMESTAMPTZ   | NO       | Record creation time |

---

### 2.6 `ventas` — Sales Records

Tracks every device TechSur sells.

| Column        | Type          | Nullable | Description |
|---------------|---------------|----------|-------------|
| id            | UUID (PK)     | NO       | Auto-generated |
| producto_id   | UUID (FK)     | NO       | References productos.id (RESTRICT delete) |
| cliente_id    | UUID (FK)     | YES      | References clientes.id (SET NULL on delete) |
| cantidad      | INTEGER       | NO       | Units sold in this transaction |
| precio_final  | NUMERIC(12,2) | NO       | Total amount collected for the whole transaction (not per unit). precio_unitario = precio_final / cantidad |
| moneda        | VARCHAR(3)    | NO       | Currency: ARS or USD |
| forma_pago    | VARCHAR(20)   | NO       | Enum: efectivo / transferencia / tarjeta / mixto |
| monto_permuta | NUMERIC(12,2) | NO       | Value of trade-in applied as discount (0 if none) |
| notas         | TEXT          | YES      | Internal notes |
| fecha_venta   | DATE          | NO       | Date of sale |
| created_at    | TIMESTAMPTZ   | NO       | Record creation time |

**Computed fields the AI should derive:**
- `ingreso_neto = precio_final - monto_permuta`  (cash actually received)
- `ganancia = precio_final - precio_compra_del_producto`

---

### 2.7 `permutas` — Trade-ins

A device the customer hands in as partial payment for a sale.
Can be linked to a sale (`venta_id`) or recorded standalone.

| Column        | Type          | Nullable | Description |
|---------------|---------------|----------|-------------|
| id            | UUID (PK)     | NO       | Auto-generated |
| venta_id      | UUID (FK)     | YES      | References ventas.id (SET NULL on delete) |
| cliente_id    | UUID (FK)     | YES      | References clientes.id (SET NULL on delete) |
| marca         | VARCHAR(60)   | NO       | Brand of the traded-in device |
| modelo        | VARCHAR(80)   | NO       | Model of the traded-in device |
| storage       | VARCHAR(20)   | YES      | Storage capacity |
| color         | VARCHAR(40)   | YES      | Color |
| condicion     | VARCHAR(20)   | NO       | Enum: bueno / regular / malo |
| bateria_salud | SMALLINT      | YES      | Battery health % |
| valor_permuta | NUMERIC(12,2) | NO       | Value credited to the customer |
| notas         | TEXT          | YES      | Internal notes |
| created_at    | TIMESTAMPTZ   | NO       | Record creation time |

---

### 2.8 `usuarios` — System Users

Internal authentication only. **The AI must never read or write this table.**

---

## 3. AI Access Levels

### 3.1 READ — Full access

The AI can query and reason over all fields in these tables:

| Table          | Accessible fields                                      |
|----------------|--------------------------------------------------------|
| productos      | All fields + derived margen_bruto, margen_porcentual   |
| producto_fotos | id, producto_id, url, orden                            |
| clientes       | All fields                                             |
| proveedores    | All fields                                             |
| compras        | All fields                                             |
| ventas         | All fields + derived ingreso_neto, ganancia            |
| permutas       | All fields                                             |

---

### 3.2 WRITE — Allowed with user confirmation

The AI can propose and execute writes after showing the user a plain-language
summary of every record that will be created or modified.

| Table       | Allowed operations    | Locked fields (never writable) |
|-------------|-----------------------|--------------------------------|
| productos   | CREATE, UPDATE, DELETE| id, created_at, updated_at |
| clientes    | CREATE, UPDATE, DELETE| id, created_at, updated_at |
| proveedores | CREATE, UPDATE, DELETE| id, created_at, updated_at |
| compras     | CREATE, DELETE        | id, created_at, producto_id (on existing), fecha_compra (on existing), precio_unitario (on existing) |
| ventas      | CREATE, DELETE        | id, created_at, producto_id (on existing), fecha_venta (on existing), precio_final (on existing) |
| permutas    | CREATE, DELETE        | id, created_at |

**Confirmation rules by risk level:**

| Risk       | Condition                                     | Required confirmation |
|------------|-----------------------------------------------|-----------------------|
| LOW        | Single CREATE of any record                   | One "yes / confirm"   |
| MEDIUM     | Single UPDATE or DELETE of any record         | Show diff / summary, then confirm |
| HIGH       | Bulk CREATE of 2–20 records                   | Show full list, then confirm |
| CRITICAL   | Bulk DELETE, or any operation on 20+ records  | Show count + sample, ask user to type "CONFIRMAR" |

---

### 3.3 BULK OPERATIONS

The AI supports batch actions described in natural language. Examples:

**Bulk stock load**
> "Cargá 5 iPhone 14 128GB Negro usados, comprados a $300.000 cada uno, precio venta $380.000, proveedor TechImport."

The AI will:
1. Parse the description into individual product + compra records
2. Show the full list to the user before touching the database
3. On confirmation, create all records sequentially (producto → compra for each unit)
4. Report success/failure per item

**Bulk price update**
> "Actualizá el precio de venta de todos los iPhone 13 disponibles a $420.000."

The AI will:
1. List matching products with their current prices
2. Show the proposed change (old → new) for every affected record
3. Apply PATCH on confirmation

**Bulk delete**
> "Eliminá todos los productos cargados hoy que tengan precio_compra = 0."

The AI will:
1. Query and list the matching records
2. Warn about cascade effects (linked compras, ventas)
3. Require the user to type "CONFIRMAR" before proceeding

**Bulk status change**
> "Marcá como vendidos todos los productos reservados antes del 1 de mayo."

Same flow: list → diff → confirm → apply.

---

### 3.4 CONTROL — API Endpoints the AI Calls as Tools

| Action                      | Method | Endpoint              | Bulk variant |
|-----------------------------|--------|-----------------------|--------------|
| List products               | GET    | /productos            | — |
| Get single product          | GET    | /productos/{id}       | — |
| Create product              | POST   | /productos            | Loop N times |
| Update product              | PATCH  | /productos/{id}       | Loop N times |
| Delete product              | DELETE | /productos/{id}       | Loop N times, CRITICAL confirmation |
| List customers              | GET    | /clientes             | — |
| Get single customer         | GET    | /clientes/{id}        | — |
| Create customer             | POST   | /clientes             | Loop N times |
| Update customer             | PATCH  | /clientes/{id}        | Loop N times |
| Delete customer             | DELETE | /clientes/{id}        | Loop N times, CRITICAL confirmation |
| List suppliers              | GET    | /proveedores          | — |
| Create supplier             | POST   | /proveedores          | Loop N times |
| Update supplier             | PATCH  | /proveedores/{id}     | Loop N times |
| Delete supplier             | DELETE | /proveedores/{id}     | CRITICAL confirmation |
| List purchases              | GET    | /compras              | — |
| Create purchase             | POST   | /compras              | Loop N times |
| Delete purchase             | DELETE | /compras/{id}         | CRITICAL confirmation |
| List sales                  | GET    | /ventas               | — |
| Create sale                 | POST   | /ventas               | Loop N times |
| Delete sale                 | DELETE | /ventas/{id}          | CRITICAL confirmation |
| List trade-ins              | GET    | /permutas             | — |
| Create trade-in             | POST   | /permutas             | Loop N times |
| Delete trade-in             | DELETE | /permutas/{id}        | CRITICAL confirmation |

---

## 4. Key Business Rules the AI Must Enforce

1. **Stock deduction on sale**: When a venta is created, `cantidad` is deducted from the linked producto's stock. If stock reaches 0, `estado` is set to "vendido" automatically. Partial sales (selling fewer units than total stock) leave the product as "disponible".
2. **Stock restoration on sale delete**: When a venta is deleted, the sold `cantidad` is added back to the producto's stock. If the producto was "vendido" and now has stock > 0, it returns to "disponible".
3. **Permuta linking**: If a venta includes `monto_permuta > 0`, a permuta record should be created and linked with `venta_id`.
4. **Margin floor warning**: Warn the user if `precio_venta <= precio_compra` before creating or updating any product. Do not block — just warn.
5. **Cascade awareness**: Before deleting a producto, check if it has linked ventas or compras. Report the impact (e.g. "this product has 1 sale record that will become orphaned") and require CRITICAL confirmation.
6. **No orphan compras**: Every compra must reference an existing `producto_id`. In bulk stock load, always create the producto before the compra.
7. **Customer optional**: Sales can be anonymous. Never force customer creation.
8. **Bulk load order**: For each unit in a bulk stock load: (1) create producto, (2) create compra linked to that producto. If step 2 fails, report the error but continue with remaining items.

---

## 5. Useful Aggregate Queries the AI Can Compute

| Query                              | Description |
|------------------------------------|-------------|
| Total stock disponible             | COUNT productos WHERE cantidad > 0 |
| Capital inmovilizado               | SUM (precio_compra * cantidad) WHERE cantidad > 0 |
| Ganancia del mes                   | SUM (precio_final - precio_compra) joined ventas + productos WHERE fecha_venta in current month |
| Producto más vendido               | productos with most ventas records |
| Margen promedio                    | AVG (precio_venta - precio_compra) / precio_compra |
| Clientes con más compras           | clientes ranked by COUNT ventas |
| Permutas pendientes de procesar    | permutas WHERE venta_id IS NULL |
| Compras por proveedor              | SUM precio_unitario GROUP BY proveedor_id |
| Stock cargado hoy                  | productos WHERE DATE(created_at) = TODAY |

---

## 6. What the AI Must Never Do

- Access or reference the `usuarios` table in any form
- Reveal `precio_compra` in user-facing output unless the user explicitly asks for cost/margin data
- Execute any write without first showing the user what will change
- Modify `precio_final`, `precio_unitario`, `fecha_venta`, or `fecha_compra` on existing records
- Change `producto_id` on an existing venta or compra
- Make assumptions about currency — all amounts are in Argentine Pesos (ARS)
- Write to `producto_fotos` (photo uploads are handled by the app, not the AI)
- Proceed past a failed step in a bulk operation without reporting the error to the user
