import { createBrowserRouter, redirect } from 'react-router'
import AdminLayout from './components/AdminLayout'
import ClientLayout from './components/ClientLayout'
import ClientLogin from './pages/client/Login'
import Onboarding from './pages/client/Onboarding'
import ClientDashboard from './pages/client/Dashboard'
import Acceso from './pages/client/Acceso'
import AdminLogin from './pages/admin/Login'
import AdminDashboard from './pages/admin/Dashboard'
import AdminClientes from './pages/admin/Clientes'
import AdminMembresias from './pages/admin/Membresias'
import AdminPagos from './pages/admin/Pagos'
import AdminStock from './pages/admin/Stock'
import AdminVentas from './pages/admin/Ventas'
import AdminAccesos from './pages/admin/Accesos'
import AdminPlanes from './pages/admin/Planes'
import AdminQR from './pages/admin/QR'
import Personal from './pages/client/Personal'
import Mensajes from './pages/client/Mensajes'
import AdminPersonal from './pages/admin/Personal'
import AdminEntrenadores from './pages/admin/Entrenadores'
import TrainerLayout from './components/TrainerLayout'
import TrainerLogin from './pages/trainer/Login'
import TrainerMensajes from './pages/trainer/Mensajes'
import TrainerFeed from './pages/trainer/Feed'

function requireClient() {
  if (localStorage.getItem('role') !== 'client') return redirect('/login')
  return null
}

function requireAdmin() {
  if (localStorage.getItem('role') !== 'admin') return redirect('/admin/login')
  return null
}

function requireTrainer() {
  if (localStorage.getItem('role') !== 'trainer') return redirect('/trainer/login')
  return null
}

export const router = createBrowserRouter([
  // ─── Client portal ───────────────────────────────────────────────────────────
  { path: '/login', Component: ClientLogin },
  { path: '/onboarding', Component: Onboarding, loader: requireClient },
  {
    path: '/',
    Component: ClientLayout,
    children: [
      { index: true, Component: ClientDashboard, loader: requireClient },
      { path: 'acceso', Component: Acceso, loader: requireClient },
      { path: 'personal', Component: Personal, loader: requireClient },
      { path: 'mensajes', Component: Mensajes, loader: requireClient },
    ],
  },
  // ─── Admin portal ────────────────────────────────────────────────────────────
  { path: '/admin/login', Component: AdminLogin },
  {
    path: '/admin',
    Component: AdminLayout,
    loader: requireAdmin,
    children: [
      { index: true, Component: AdminDashboard },
      { path: 'clientes', Component: AdminClientes },
      { path: 'membresias', Component: AdminMembresias },
      { path: 'pagos', Component: AdminPagos },
      { path: 'stock', Component: AdminStock },
      { path: 'ventas', Component: AdminVentas },
      { path: 'planes', Component: AdminPlanes },
      { path: 'accesos', Component: AdminAccesos },
      { path: 'qr', Component: AdminQR },
      { path: 'personal', Component: AdminPersonal },
      { path: 'entrenadores', Component: AdminEntrenadores },
    ],
  },
  // ─── Trainer portal ──────────────────────────────────────────────────────────
  { path: '/trainer/login', Component: TrainerLogin },
  {
    path: '/trainer',
    Component: TrainerLayout,
    loader: requireTrainer,
    children: [
      { index: true, Component: TrainerMensajes },
      { path: 'feed', Component: TrainerFeed },
    ],
  },
])
