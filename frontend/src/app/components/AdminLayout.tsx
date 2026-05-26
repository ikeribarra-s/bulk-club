import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router'
import { Dumbbell, Users, CreditCard, DollarSign, Package, ShoppingCart, LogIn, LayoutDashboard, LogOut, ClipboardList, QrCode, Rss, Camera, X, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { authApi, adminMeApi, feedApi, type AdminMe } from '../api'

const links = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/clientes', label: 'Clientes', icon: Users },
  { to: '/admin/planes', label: 'Planes', icon: ClipboardList },
  { to: '/admin/membresias', label: 'Membresías', icon: CreditCard },
  { to: '/admin/pagos', label: 'Pagos', icon: DollarSign },
  { to: '/admin/stock', label: 'Stock', icon: Package },
  { to: '/admin/ventas', label: 'Ventas', icon: ShoppingCart },
  { to: '/admin/accesos', label: 'Accesos', icon: LogIn },
  { to: '/admin/qr', label: 'QR de acceso', icon: QrCode },
  { to: '/admin/personal', label: 'Feed', icon: Rss },
]

// ─── Edit modal ───────────────────────────────────────────────────────────────

function EditAdminProfileModal({
  admin,
  onClose,
  onSaved,
}: {
  admin: AdminMe
  onClose: () => void
  onSaved: (updated: AdminMe) => void
}) {
  const [username, setUsername] = useState(admin.username)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!username.trim()) return
    setSaving(true)
    try {
      const updated = await adminMeApi.update({ username: username.trim() })
      onSaved(updated)
      onClose()
      toast.success('Perfil actualizado')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Editar perfil admin</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">
              Nombre de usuario
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-black transition-colors"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
            />
          </div>
        </div>
        <div className="px-5 pb-5">
          <button
            onClick={handleSave}
            disabled={saving || !username.trim()}
            className="w-full bg-black text-white py-2.5 rounded-xl font-medium text-sm hover:opacity-80 disabled:opacity-40 transition-opacity"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function AdminLayout() {
  const navigate = useNavigate()
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [admin, setAdmin] = useState<AdminMe | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  useEffect(() => {
    adminMeApi.get().then(setAdmin).catch(() => {})
  }, [])

  async function handleLogout() {
    await authApi.logout()
    localStorage.removeItem('role')
    navigate('/admin/login')
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !admin) return
    setUploadingAvatar(true)
    try {
      const url = await feedApi.uploadImage(file)
      const updated = await adminMeApi.update({ foto_url: url })
      setAdmin(updated)
      toast.success('Foto actualizada')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-56 bg-black text-white flex flex-col shrink-0">
        <div className="px-5 py-5 flex items-center gap-2 font-bold text-lg tracking-tight border-b border-white/10">
          <Dumbbell size={20} />
          Bulk Club
        </div>

        {/* Admin profile widget */}
        {admin && (
          <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
            <div className="relative shrink-0">
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="w-9 h-9 rounded-full overflow-hidden ring-1 ring-white/20 hover:ring-white/60 transition-all group relative"
              >
                {admin.foto_url ? (
                  <img src={admin.foto_url} alt={admin.username} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-white/10 flex items-center justify-center text-white text-sm font-bold">
                    {admin.username[0].toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {uploadingAvatar
                    ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                    : <Camera size={12} className="text-white" />
                  }
                </div>
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{admin.username}</p>
              <p className="text-[10px] text-gray-400">Admin</p>
            </div>
            <button
              onClick={() => setShowEdit(true)}
              className="text-gray-400 hover:text-white transition-colors shrink-0"
              title="Editar perfil"
            >
              <Pencil size={13} />
            </button>
          </div>
        )}

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

      {showEdit && admin && (
        <EditAdminProfileModal
          admin={admin}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => setAdmin(updated)}
        />
      )}
    </div>
  )
}
