// ─── Types ────────────────────────────────────────────────────────────────────

export interface Cliente {
  id: string
  nombre: string | null
  apellido: string | null
  email: string
  telefono: string | null
  dni: string | null
  habilitado: boolean
  created_at: string
}

export interface ClienteConPlan extends Cliente {
  plan_nombre: string | null
  plan_id: string | null
  membresia_id: string | null
  fecha_vencimiento: string | null
  membresia_activa: boolean
}

export interface Plan {
  id: string
  nombre: string
  dias_por_semana: number | null
  precio_mensual: number
  descripcion: string | null
  activo: boolean
}

export interface Membresia {
  id: string
  cliente_id: string
  plan_id: string
  fecha_inicio: string
  fecha_vencimiento: string
  activa: boolean
  created_at: string
  plan_nombre?: string | null
  cliente_nombre?: string | null
  cliente_apellido?: string | null
  cliente_dni?: string | null
}

export interface Pago {
  id: string
  cliente_id: string
  membresia_id: string | null
  monto: number
  fecha_pago: string
  forma_pago: string
  notas: string | null
  created_at: string
  cliente_nombre?: string | null
  cliente_apellido?: string | null
}

export interface Acceso {
  id: string
  cliente_id: string
  fecha_hora: string
  resultado: 'permitido' | 'denegado'
  motivo: string | null
  cliente_nombre?: string | null
  cliente_apellido?: string | null
  cliente_dni?: string | null
}

export interface Producto {
  id: string
  nombre: string
  descripcion: string | null
  precio: number
  stock: number
  created_at: string
}

export interface VentaProducto {
  id: string
  cliente_id: string
  producto_id: string
  cantidad: number
  precio_unitario: number
  pagado: boolean
  fecha_venta: string
  producto_nombre?: string | null
  cliente_nombre?: string | null
  cliente_apellido?: string | null
}

export interface TabBalance {
  items: VentaProducto[]
  total: number
}

export interface DashboardData {
  active_members: number
  today_checkins: number
  pending_activation: { id: string; nombre: string | null; apellido: string | null; dni: string | null; email: string }[]
  expiring_soon: { membresia_id: string; cliente_id: string; cliente_nombre: string | null; cliente_apellido: string | null; plan_nombre: string; fecha_vencimiento: string; dias_restantes: number }[]
  expired: { membresia_id: string; cliente_id: string; cliente_nombre: string | null; cliente_apellido: string | null; plan_nombre: string; fecha_vencimiento: string; dias_vencida: number }[]
  low_stock: { id: string; nombre: string; stock: number }[]
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...options })
  if (res.status === 401) {
    const role = localStorage.getItem('role')
    localStorage.removeItem('role')
    window.location.href = role === 'admin' ? '/admin/login' : '/login'
    throw new Error('Sesión expirada')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Error desconocido' }))
    throw new Error(err.detail ?? 'Error desconocido')
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  googleLogin: (token: string) =>
    apiFetch<{ role: string; onboarded: boolean; habilitado: boolean }>('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }),
  adminLogin: (username: string, password: string) => {
    const form = new URLSearchParams({ username, password })
    return apiFetch<{ role: string }>('/api/auth/admin/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
  },
  clientLogin: (dni: string, password: string) => {
    const form = new URLSearchParams({ username: dni, password })
    return apiFetch<{ role: string; onboarded: boolean; habilitado: boolean }>('/api/auth/client/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
  },
  logout: () => apiFetch<void>('/api/auth/logout', { method: 'POST' }),
}

// ─── Me (client) ──────────────────────────────────────────────────────────────

export const meApi = {
  onboarding: (nombre: string, apellido: string, dni: string) =>
    apiFetch<{ pending: boolean; message: string }>('/api/me/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, apellido, dni }),
    }),
  status: () => apiFetch<{ id: string; onboarded: boolean; habilitado: boolean; nombre: string | null; apellido: string | null; foto_url: string | null; bio: string | null; membresia: { plan_nombre: string; fecha_vencimiento: string; activa: boolean } | null }>('/api/me/status'),
  updateProfile: (body: { bio?: string | null; foto_url?: string | null }) =>
    apiFetch<{ foto_url: string | null; bio: string | null }>('/api/me/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  accesos: () => apiFetch<Acceso[]>('/api/me/accesos'),
  tab: () => apiFetch<TabBalance>('/api/me/tab'),
}

// ─── Check-in ─────────────────────────────────────────────────────────────────

export const accesoApi = {
  check: () =>
    apiFetch<{ ok: boolean; message: string; motivo?: string }>('/api/acceso/check', { method: 'POST' }),
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export const adminClientesApi = {
  list: (busqueda?: string) => apiFetch<ClienteConPlan[]>(`/api/admin/clientes${busqueda ? `?busqueda=${encodeURIComponent(busqueda)}` : ''}`),
  get: (id: string) => apiFetch<ClienteConPlan>(`/api/admin/clientes/${id}`),
  create: (body: { nombre?: string; apellido?: string; email?: string; telefono?: string; dni: string; password?: string }) => apiFetch<Cliente>('/api/admin/clientes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  update: (id: string, body: Partial<Cliente>) => apiFetch<Cliente>(`/api/admin/clientes/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  delete: (id: string) => apiFetch<void>(`/api/admin/clientes/${id}`, { method: 'DELETE' }),
  habilitar: (id: string) => apiFetch<Cliente>(`/api/admin/clientes/${id}/habilitar`, { method: 'POST' }),
  deshabilitar: (id: string) => apiFetch<Cliente>(`/api/admin/clientes/${id}/deshabilitar`, { method: 'POST' }),
  renovar: (id: string, forma_pago: string) => apiFetch<{ message: string; nueva_fecha_vencimiento: string; monto_pagado: number; plan: string }>(`/api/admin/clientes/${id}/renovar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ forma_pago }) }),
  resetPassword: (id: string) => apiFetch<Cliente>(`/api/admin/clientes/${id}/reset-password`, { method: 'POST' }),
}

export const adminMembresiasApi = {
  list: (params?: { estado?: string; cliente_id?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString()
    return apiFetch<Membresia[]>(`/api/admin/membresias${qs ? `?${qs}` : ''}`)
  },
  create: (body: Partial<Membresia>) => apiFetch<Membresia>('/api/admin/membresias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  renovar: (id: string) => apiFetch<Membresia>(`/api/admin/membresias/${id}/renovar`, { method: 'POST' }),
  update: (id: string, body: Partial<Membresia>) => apiFetch<Membresia>(`/api/admin/membresias/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  delete: (id: string) => apiFetch<void>(`/api/admin/membresias/${id}`, { method: 'DELETE' }),
}

export const adminPanosApi = {
  list: () => apiFetch<Plan[]>('/api/admin/planes'),
  create: (body: Partial<Plan>) => apiFetch<Plan>('/api/admin/planes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  update: (id: string, body: Partial<Plan>) => apiFetch<Plan>(`/api/admin/planes/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  delete: (id: string) => apiFetch<void>(`/api/admin/planes/${id}`, { method: 'DELETE' }),
}

export const adminPagosApi = {
  list: (cliente_id?: string) => apiFetch<Pago[]>(`/api/admin/pagos${cliente_id ? `?cliente_id=${cliente_id}` : ''}`),
  create: (body: Partial<Pago>) => apiFetch<Pago>('/api/admin/pagos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  delete: (id: string) => apiFetch<void>(`/api/admin/pagos/${id}`, { method: 'DELETE' }),
}

export const adminProductosApi = {
  list: () => apiFetch<Producto[]>('/api/admin/productos'),
  create: (body: Partial<Producto>) => apiFetch<Producto>('/api/admin/productos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  update: (id: string, body: Partial<Producto>) => apiFetch<Producto>(`/api/admin/productos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  delete: (id: string) => apiFetch<void>(`/api/admin/productos/${id}`, { method: 'DELETE' }),
}

export const adminVentasApi = {
  list: (params?: { cliente_id?: string; pagado?: boolean }) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))).toString()
    return apiFetch<VentaProducto[]>(`/api/admin/ventas${qs ? `?${qs}` : ''}`)
  },
  create: (body: { cliente_id: string; producto_id: string; cantidad: number; pagado: boolean }) =>
    apiFetch<VentaProducto>('/api/admin/ventas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  marcarPagado: (id: string) => apiFetch<VentaProducto>(`/api/admin/ventas/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pagado: true }) }),
  delete: (id: string) => apiFetch<void>(`/api/admin/ventas/${id}`, { method: 'DELETE' }),
}

export const adminAccesosApi = {
  list: (params?: { cliente_id?: string; fecha?: string }) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v))).toString()
    return apiFetch<Acceso[]>(`/api/admin/accesos${qs ? `?${qs}` : ''}`)
  },
}

export const adminDashboardApi = {
  get: () => apiFetch<DashboardData>('/api/admin/dashboard'),
}

// ─── Admin Me ─────────────────────────────────────────────────────────────────

export interface AdminMe {
  id: string
  username: string
  foto_url: string | null
}

export const adminMeApi = {
  get: () => apiFetch<AdminMe>('/api/admin/me'),
  update: (body: { username?: string | null; foto_url?: string | null }) =>
    apiFetch<AdminMe>('/api/admin/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
}

// ─── Feed ─────────────────────────────────────────────────────────────────────

export interface Ejercicio {
  nombre: string
  series: number | null
  repeticiones: string | null
  peso_kg: number | null
  notas: string | null
  orden: number
}

export interface Rutina {
  nombre: string
  descripcion: string | null
  ejercicios: Ejercicio[]
}

export interface FeedPost {
  id: string
  author_id: string
  author_type: 'client' | 'admin'
  author_name: string
  author_foto_url: string | null
  tipo: 'general' | 'rutina'
  titulo: string | null
  contenido: string | null
  imagen_url: string | null
  rutina: Rutina | null
  like_count: number
  comment_count: number
  liked_by_me: boolean
  created_at: string
}

export interface FeedComment {
  id: string
  post_id: string
  author_id: string
  author_type: 'client' | 'admin'
  author_name: string
  contenido: string
  parent_comment_id: string | null
  edited_at: string | null
  created_at: string
}

export interface PostCreateBody {
  tipo: 'general' | 'rutina'
  titulo?: string | null
  contenido?: string | null
  imagen_url?: string | null
  rutina?: {
    nombre: string
    descripcion?: string | null
    ejercicios: Partial<Ejercicio>[]
  } | null
}

export const feedApi = {
  list: (skip = 0, limit = 20) =>
    apiFetch<FeedPost[]>(`/api/feed?skip=${skip}&limit=${limit}`),
  listByAuthor: (authorId: string, limit = 50) =>
    apiFetch<FeedPost[]>(`/api/feed?author_id=${authorId}&limit=${limit}`),
  create: (body: PostCreateBody) =>
    apiFetch<FeedPost>('/api/feed/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  delete: (id: string) =>
    apiFetch<void>(`/api/feed/posts/${id}`, { method: 'DELETE' }),
  like: (id: string) =>
    apiFetch<{ liked: boolean; like_count: number }>(`/api/feed/posts/${id}/like`, { method: 'POST' }),
  getLikes: (id: string) =>
    apiFetch<{ cliente_id: string; author_name: string }[]>(`/api/feed/posts/${id}/likes`),
  getComments: (id: string) =>
    apiFetch<FeedComment[]>(`/api/feed/posts/${id}/comments`),
  addComment: (id: string, contenido: string, parent_comment_id?: string | null) =>
    apiFetch<FeedComment>(`/api/feed/posts/${id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contenido, parent_comment_id: parent_comment_id ?? null }),
    }),
  editComment: (id: string, contenido: string) =>
    apiFetch<FeedComment>(`/api/feed/comments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contenido }),
    }),
  deleteComment: (id: string) =>
    apiFetch<void>(`/api/feed/comments/${id}`, { method: 'DELETE' }),
  uploadImage: async (file: File): Promise<string> => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/feed/upload', { method: 'POST', credentials: 'include', body: form })
    if (res.status === 401) {
      localStorage.removeItem('role')
      window.location.href = '/login'
      throw new Error('Sesión expirada')
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Error al subir imagen' }))
      throw new Error(err.detail ?? 'Error al subir imagen')
    }
    return (await res.json()).url
  },
}
