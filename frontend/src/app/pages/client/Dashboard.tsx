import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Camera,
  Pencil,
  X,
  Dumbbell,
  Image as ImageIcon,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { meApi, feedApi, type Acceso, type TabBalance, type FeedPost } from '../../api'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = {
  id: string
  onboarded: boolean
  habilitado: boolean
  nombre: string | null
  apellido: string | null
  foto_url: string | null
  bio: string | null
  membresia: { plan_nombre: string; fecha_vencimiento: string; activa: boolean } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(nombre: string | null, apellido: string | null) {
  return [nombre, apellido]
    .filter(Boolean)
    .map((s) => s![0].toUpperCase())
    .join('')
    || '?'
}

// ─── EditProfileModal ─────────────────────────────────────────────────────────

function EditProfileModal({
  status,
  onClose,
  onSaved,
}: {
  status: Status
  onClose: () => void
  onSaved: (updates: { bio: string | null }) => void
}) {
  const [bio, setBio] = useState(status.bio ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await meApi.updateProfile({ bio: bio.trim() || null })
      onSaved({ bio: res.bio })
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Editar perfil</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">
              Biografía
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 300))}
              placeholder="Contanos algo sobre vos…"
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-black resize-none transition-colors"
            />
            <p className="text-[10px] text-gray-400 text-right mt-0.5">{bio.length}/300</p>
          </div>
        </div>
        <div className="px-5 pb-5">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-black text-white py-2.5 rounded-xl font-medium text-sm hover:opacity-80 disabled:opacity-40 transition-opacity"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MiniPostCard ─────────────────────────────────────────────────────────────

function MiniPostCard({ post }: { post: FeedPost }) {
  const hasImage = !!post.imagen_url
  const isRutina = post.tipo === 'rutina'
  const preview = post.titulo || post.contenido?.slice(0, 80) || (isRutina ? post.rutina?.nombre : null)

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {hasImage ? (
        <img
          src={post.imagen_url!}
          alt=""
          className="w-full aspect-square object-cover"
          loading="lazy"
        />
      ) : (
        <div className={`aspect-square flex flex-col items-center justify-center gap-1.5 px-2 ${isRutina ? 'bg-gray-950' : 'bg-gray-50'}`}>
          {isRutina ? (
            <Dumbbell size={22} className="text-white/80" />
          ) : (
            <FileText size={22} className="text-gray-300" />
          )}
          {preview && (
            <p className={`text-[10px] text-center leading-tight line-clamp-3 ${isRutina ? 'text-white/70' : 'text-gray-400'}`}>
              {preview}
            </p>
          )}
        </div>
      )}
      <div className="px-2 py-1.5 flex items-center justify-between">
        <span className="text-[10px] text-gray-400">
          {post.like_count > 0 && `♥ ${post.like_count}`}
        </span>
        <span className="text-[10px] text-gray-400">
          {post.comment_count > 0 && `💬 ${post.comment_count}`}
        </span>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ClientDashboard() {
  const navigate = useNavigate()
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const [status, setStatus] = useState<Status | null>(null)
  const [accesos, setAccesos] = useState<Acceso[]>([])
  const [tab, setTab] = useState<TabBalance | null>(null)
  const [myPosts, setMyPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  useEffect(() => {
    Promise.all([
      meApi.status(),
      meApi.accesos().catch(() => [] as Acceso[]),
      meApi.tab().catch(() => null),
    ]).then(([s, a, t]) => {
      setStatus(s)
      setAccesos(a as Acceso[])
      setTab(t)
      if (!s.onboarded || !s.habilitado) {
        navigate('/onboarding')
        return
      }
      feedApi.listByAuthor(s.id).then(setMyPosts).catch(() => {})
    }).finally(() => setLoading(false))
  }, [])

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !status) return
    setUploadingAvatar(true)
    try {
      const url = await feedApi.uploadImage(file)
      await meApi.updateProfile({ foto_url: url })
      setStatus((prev) => prev ? { ...prev, foto_url: url } : prev)
      toast.success('Foto actualizada')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 py-2">
        {/* Avatar skeleton */}
        <div className="flex items-center gap-5 py-4">
          <div className="w-20 h-20 rounded-full bg-gray-200 animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
        <div className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (!status) return null

  const displayName = [status.nombre, status.apellido].filter(Boolean).join(' ') || 'Mi perfil'
  const membresia = status.membresia
  const postCount = myPosts.length

  return (
    <div className="flex flex-col gap-4 py-2 pb-8">

      {/* ── Profile header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center text-center pt-2 pb-1">
        {/* Avatar */}
        <div className="relative mb-3">
          <button
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="relative w-24 h-24 rounded-full overflow-hidden ring-2 ring-gray-200 hover:ring-black transition-all group"
          >
            {status.foto_url ? (
              <img
                src={status.foto_url}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-black flex items-center justify-center text-white text-2xl font-bold">
                {initials(status.nombre, status.apellido)}
              </div>
            )}
            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              {uploadingAvatar
                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Camera size={20} className="text-white" />
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

        {/* Name */}
        <h2 className="text-lg font-bold text-gray-900">{displayName}</h2>

        {/* Bio */}
        {status.bio && (
          <p className="text-sm text-gray-500 mt-1 max-w-xs leading-snug">{status.bio}</p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-6 mt-3">
          <div className="text-center">
            <p className="text-base font-bold text-gray-900">{postCount === 50 ? '50+' : postCount}</p>
            <p className="text-[11px] text-gray-400">publicaciones</p>
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-gray-900">{accesos.filter(a => a.resultado === 'permitido').length}</p>
            <p className="text-[11px] text-gray-400">ingresos</p>
          </div>
        </div>

        {/* Edit profile button */}
        <button
          onClick={() => setShowEdit(true)}
          className="mt-3 flex items-center gap-1.5 border border-gray-200 rounded-lg px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Pencil size={12} />
          Editar perfil
        </button>
      </div>

      {/* ── Membership card ────────────────────────────────────────────────── */}
      <div className={`rounded-2xl p-5 text-white ${membresia?.activa ? 'bg-black' : 'bg-red-600'}`}>
        <p className="text-xs uppercase tracking-widest opacity-70 mb-1">Tu membresía</p>
        {membresia ? (
          <>
            <h2 className="text-xl font-bold">{membresia.plan_nombre}</h2>
            <div className="flex items-center gap-1.5 mt-2 text-sm opacity-80">
              <Calendar size={14} />
              Vence: {format(parseISO(membresia.fecha_vencimiento), "d 'de' MMMM yyyy", { locale: es })}
            </div>
            {!membresia.activa && (
              <p className="mt-2 text-xs bg-white/20 rounded-md px-2 py-1 inline-block">
                Cuota vencida — contactá al administrador
              </p>
            )}
          </>
        ) : (
          <p className="text-sm opacity-80 mt-1">Sin membresía asignada</p>
        )}
      </div>

      {/* ── Tab balance ────────────────────────────────────────────────────── */}
      {tab && tab.total > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-amber-900 text-sm">Tab pendiente</p>
            <p className="text-amber-700 text-sm">
              Debés ${tab.total.toLocaleString('es-AR')} en productos
            </p>
            <ul className="mt-1 space-y-0.5">
              {tab.items.map((item) => (
                <li key={item.id} className="text-xs text-amber-600">
                  {item.producto_nombre} × {item.cantidad} —{' '}
                  ${(item.precio_unitario * item.cantidad).toLocaleString('es-AR')}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ── My posts ───────────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
          <ImageIcon size={13} />
          Mis publicaciones
        </h3>
        {myPosts.length === 0 ? (
          <div className="text-center py-8 text-gray-400 bg-white rounded-2xl border border-gray-100">
            <Dumbbell size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs">Todavía no publicaste nada</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {myPosts.map((post) => (
              <MiniPostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>

      {/* ── Recent check-ins ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <h3 className="font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-500" />
          Últimos ingresos
        </h3>
        {accesos.length === 0 ? (
          <p className="text-gray-400 text-sm">Sin ingresos registrados</p>
        ) : (
          <ul className="space-y-2">
            {accesos.slice(0, 5).map((a) => (
              <li key={a.id} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-600">
                  {a.resultado === 'permitido' ? (
                    <CheckCircle2 size={14} className="text-green-500" />
                  ) : (
                    <Clock size={14} className="text-red-400" />
                  )}
                  {format(parseISO(a.fecha_hora), "d MMM yyyy, HH:mm", { locale: es })}
                </span>
                {a.resultado === 'denegado' && (
                  <span className="text-xs text-red-400">
                    {a.motivo?.replace(/_/g, ' ')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Edit profile modal ─────────────────────────────────────────────── */}
      {showEdit && (
        <EditProfileModal
          status={status}
          onClose={() => setShowEdit(false)}
          onSaved={(updates) => setStatus((prev) => prev ? { ...prev, ...updates } : prev)}
        />
      )}
    </div>
  )
}
