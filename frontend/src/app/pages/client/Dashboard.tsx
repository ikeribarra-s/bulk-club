import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Calendar, ShoppingBag, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import { meApi, type Acceso, type TabBalance } from '../../api'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export default function ClientDashboard() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<{ onboarded: boolean; habilitado: boolean; nombre: string | null; apellido: string | null; membresia: { plan_nombre: string; fecha_vencimiento: string; activa: boolean } | null } | null>(null)
  const [accesos, setAccesos] = useState<Acceso[]>([])
  const [tab, setTab] = useState<TabBalance | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([meApi.status(), meApi.accesos().catch(() => []), meApi.tab().catch(() => null)])
      .then(([s, a, t]) => {
        setStatus(s)
        setAccesos(a as Acceso[])
        setTab(t)
        if (!s.onboarded || !s.habilitado) navigate('/onboarding')
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Cargando...</div>
  }

  const membresia = status?.membresia
  const nombre = status?.nombre ? `${status.nombre} ${status.apellido ?? ''}`.trim() : null

  return (
    <div className="flex flex-col gap-4 py-2">
      {nombre && (
        <div>
          <p className="text-xs text-gray-400">Bienvenido</p>
          <h2 className="text-xl font-bold text-gray-900">{nombre}</h2>
        </div>
      )}

      {/* Membership card */}
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

      {/* Tab balance */}
      {tab && tab.total > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-amber-900 text-sm">Tab pendiente</p>
            <p className="text-amber-700 text-sm">Debés ${tab.total.toLocaleString('es-AR')} en productos</p>
            <ul className="mt-1 space-y-0.5">
              {tab.items.map(item => (
                <li key={item.id} className="text-xs text-amber-600">
                  {item.producto_nombre} × {item.cantidad} — ${(item.precio_unitario * item.cantidad).toLocaleString('es-AR')}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Recent check-ins */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <h3 className="font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-500" />
          Últimos ingresos
        </h3>
        {accesos.length === 0 ? (
          <p className="text-gray-400 text-sm">Sin ingresos registrados</p>
        ) : (
          <ul className="space-y-2">
            {accesos.slice(0, 5).map(a => (
              <li key={a.id} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-600">
                  {a.resultado === 'permitido'
                    ? <CheckCircle2 size={14} className="text-green-500" />
                    : <Clock size={14} className="text-red-400" />}
                  {format(parseISO(a.fecha_hora), "d MMM yyyy, HH:mm", { locale: es })}
                </span>
                {a.resultado === 'denegado' && (
                  <span className="text-xs text-red-400">{a.motivo?.replace(/_/g, ' ')}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
