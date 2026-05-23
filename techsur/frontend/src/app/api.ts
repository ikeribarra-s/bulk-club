const BASE = import.meta.env.VITE_API_URL ?? ''

async function request(
  method: string,
  path: string,
  options: RequestInit = {},
  params?: Record<string, string>
) {
  const url = new URL(BASE + path, window.location.origin)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString(), {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (res.status === 401) {
    localStorage.removeItem('loggedIn')
    window.location.href = '/login'
    throw new Error('Sesión expirada')
  }
  if (res.status === 204) return null
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  get: (path: string, params?: Record<string, string>) => request('GET', path, {}, params),
  post: (path: string, body: unknown) =>
    request('POST', path, { body: JSON.stringify(body) }),
  put: (path: string, body: unknown) =>
    request('PUT', path, { body: JSON.stringify(body) }),
  patch: (path: string, body: unknown) =>
    request('PATCH', path, { body: JSON.stringify(body) }),
  delete: (path: string) => request('DELETE', path),
}

export async function uploadFile(
  path: string,
  file: File,
  timeout = 120_000
): Promise<unknown> {
  const form = new FormData()
  form.append('file', file)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  const res = await fetch(BASE + path, {
    method: 'POST',
    credentials: 'include',
    body: form,
    signal: controller.signal,
  })
  clearTimeout(timer)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export const parseDecimal = (v: string | null | undefined): number =>
  v ? parseFloat(v) : 0

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Producto {
  id: string
  nombre: string
  marca: string
  modelo: string
  storage: string | null
  color: string | null
  condicion: 'nuevo' | 'usado' | 'reacondicionado'
  bateria_salud: number | null
  cantidad: number
  precio_compra: string
  precio_venta: string
  estado: 'disponible' | 'reservado' | 'vendido'
  notas: string | null
  created_at: string
  updated_at: string
}

export interface Cliente {
  id: string
  nombre: string
  apellido: string | null
  dni: string | null
  telefono: string | null
  email: string | null
  direccion: string | null
  notas: string | null
}

export interface Proveedor {
  id: string
  nombre: string
  contacto: string | null
  telefono: string | null
  email: string | null
  notas: string | null
}

export interface Compra {
  id: string
  proveedor_id: string | null
  producto_id: string
  cantidad: number
  precio_unitario: string
  fecha_compra: string
  forma_pago: 'efectivo' | 'transferencia' | 'tarjeta'
  notas: string | null
  created_at: string
}

export interface Venta {
  id: string
  producto_id: string
  cliente_id: string | null
  cantidad: number
  precio_final: string
  moneda: 'ARS' | 'USD'
  forma_pago: 'efectivo' | 'transferencia' | 'tarjeta' | 'mixto'
  monto_permuta: string
  notas: string | null
  fecha_venta: string
  created_at: string
}

export interface Permuta {
  id: string
  venta_id: string | null
  cliente_id: string | null
  marca: string
  modelo: string
  storage: string | null
  color: string | null
  condicion: 'bueno' | 'regular' | 'malo'
  bateria_salud: number | null
  valor_permuta: string
  notas: string | null
  created_at: string
}

export interface VentaLabel {
  id: string
  label: string
}

export interface HistorialCambio {
  id: string
  tabla: string
  registro_id: string
  operacion: 'CREATE' | 'UPDATE' | 'DELETE'
  antes: Record<string, unknown> | null
  despues: Record<string, unknown> | null
  fuente: string
  resumen: string
  created_at: string
}
