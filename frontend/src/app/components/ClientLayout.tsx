import { Outlet, NavLink, useNavigate } from 'react-router'
import { Dumbbell, QrCode, LogOut, UserCircle, Rss } from 'lucide-react'
import { authApi } from '../api'
import { toast } from 'sonner'

export default function ClientLayout() {
  const navigate = useNavigate()

  async function handleLogout() {
    await authApi.logout()
    localStorage.removeItem('role')
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-black text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <Dumbbell size={20} />
          Bulk Club
        </div>
        <button onClick={handleLogout} className="text-gray-400 hover:text-white transition-colors">
          <LogOut size={18} />
        </button>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full p-4">
        <Outlet />
      </main>

      <nav className="bg-white border-t border-gray-200 sticky bottom-0">
        <div className="max-w-lg mx-auto flex">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-3 text-xs gap-1 transition-colors ${isActive ? 'text-black font-semibold' : 'text-gray-400'}`
            }
          >
            <UserCircle size={20} />
            Mi cuenta
          </NavLink>
          <NavLink
            to="/personal"
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-3 text-xs gap-1 transition-colors ${isActive ? 'text-black font-semibold' : 'text-gray-400'}`
            }
          >
            <Rss size={20} />
            Feed
          </NavLink>
          <NavLink
            to="/acceso"
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-3 text-xs gap-1 transition-colors ${isActive ? 'text-black font-semibold' : 'text-gray-400'}`
            }
          >
            <QrCode size={20} />
            Ingresar
          </NavLink>
        </div>
      </nav>
    </div>
  )
}
