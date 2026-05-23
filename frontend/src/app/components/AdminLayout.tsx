import { Outlet, NavLink, useNavigate } from 'react-router'
import { Dumbbell, Users, CreditCard, DollarSign, Package, ShoppingCart, LogIn, LayoutDashboard, LogOut, ClipboardList } from 'lucide-react'
import { authApi } from '../api'

const links = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/clientes', label: 'Clientes', icon: Users },
  { to: '/admin/planes', label: 'Planes', icon: ClipboardList },
  { to: '/admin/membresias', label: 'Membresías', icon: CreditCard },
  { to: '/admin/pagos', label: 'Pagos', icon: DollarSign },
  { to: '/admin/stock', label: 'Stock', icon: Package },
  { to: '/admin/ventas', label: 'Ventas', icon: ShoppingCart },
  { to: '/admin/accesos', label: 'Accesos', icon: LogIn },
]

export default function AdminLayout() {
  const navigate = useNavigate()

  async function handleLogout() {
    await authApi.logout()
    localStorage.removeItem('role')
    navigate('/admin/login')
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-56 bg-black text-white flex flex-col shrink-0">
        <div className="px-5 py-5 flex items-center gap-2 font-bold text-lg tracking-tight border-b border-white/10">
          <Dumbbell size={20} />
          Bulk Club
        </div>
        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive ? 'bg-white/15 text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-5 py-4 text-sm text-gray-400 hover:text-white border-t border-white/10 transition-colors"
        >
          <LogOut size={16} /> Cerrar sesión
        </button>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
