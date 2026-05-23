import { NavLink, Outlet, useNavigate } from "react-router";
import { LogOut } from "lucide-react";
import { api } from "../api";
import AiChat from "./AiChat";

const navItems = [
  { path: '/', label: 'Inicio' },
  { path: '/inventario', label: 'Inventario' },
  { path: '/clientes', label: 'Clientes' },
  { path: '/ventas', label: 'Ventas' },
  { path: '/proveedores', label: 'Proveedores' },
  { path: '/compras', label: 'Compras' },
  { path: '/permutas', label: 'Permutas' },
  { path: '/historial', label: 'Historial' },
];

export default function Layout() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await api.post('/auth/logout', {}).catch(() => null);
    localStorage.removeItem('loggedIn');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="overflow-x-auto">
          <div className="flex items-center gap-1 px-4 min-w-max">
            <span className="text-sm font-bold text-[#2563EB] mr-3 py-4 tracking-tight">TechSur</span>
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `px-4 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'text-[#2563EB] border-b-2 border-[#2563EB]'
                      : 'text-gray-600 hover:text-gray-900 border-b-2 border-transparent'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <button
              onClick={handleLogout}
              className="ml-auto px-4 py-4 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1"
            >
              <LogOut className="w-4 h-4" />
              Salir
            </button>
          </div>
        </div>
      </nav>
      <main className="p-4 md:p-6 lg:p-8">
        <Outlet />
      </main>
      <AiChat />
    </div>
  );
}
