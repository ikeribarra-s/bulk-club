import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Users, LogIn, Clock, Package, TrendingUp, AlertTriangle, XCircle, CheckCircle } from 'lucide-react'
import { adminDashboardApi, adminClientesApi, type DashboardData } from '../../api'
import { toast } from 'sonner'

function KpiCard({
  label, value, icon: Icon, accent, onClick,
}: {
  label: string
  value: number | string
  icon: React.ElementType
  accent: 'green' | 'blue' | 'amber' | 'red' | 'gray'
  onClick?: () => void
}) {
  const colors = {
    green: { bg: 'bg-green-50', icon: 'text-green-600', bar: 'bg-green-500', value: 'text-green-700' },
    blue:  { bg: 'bg-blue-50',  icon: 'text-blue-600',  bar: 'bg-blue-500',  value: 'text-blue-700'  },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-600', bar: 'bg-amber-500', value: 'text-amber-700' },
    red:   { bg: 'bg-red-50',   icon: 'text-red-600',   bar: 'bg-red-500',   value: 'text-red-700'   },
    gray:  { bg: 'bg-gray-50',  icon: 'text-gray-600',  bar: 'bg-gray-400',  value: 'text-gray-800'  },
  }
  const c = colors[accent]

  return (
    <button
      onClick={onClick}
      className={`bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-4 text-left shadow-sm hover:shadow-md transition-shadow w-full ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-center justify-between">
        <div className={`${c.bg} rounded-xl p-2.5`}>
          <Icon size={20} className={c.icon} />
        </div>
        <div className={`h-1 w-12 rounded-full ${c.bar} opacity-40`} />
      </div>
      <div>
        <p className={`text-3xl font-bold tracking-tight ${c.value}`}>{value}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      </div>
    </button>
  )
}

function SectionHeader({ title, count, icon: Icon, color }: { title: string; count: number; icon: React.ElementType; color: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon size={16} className={color} />
      <h2 className="font-semibold text-gray-800">{title}</h2>
      <span className="ml-auto text-xs font-semibold bg-gray-100 text-gray-500 rounded-full px-2.5 py-0.5">{count}</span>
    </div>
  )
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  function refresh() {
    adminDashboardApi.get().then(setData).catch(e => toast.error(e.message))
  }

  useEffect(() => {
    adminDashboardApi.get().then(setData).catch(e => toast.error(e.message)).finally(() => setLoading(false))
  }, [])

  async function handleHabilitar(id: string) {
    try {
      await adminClientesApi.habilitar(id)
      toast.success('Cliente habilitado')
      refresh()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-400 text-sm animate-pulse">Cargando dashboard...</p>
    </div>
  )
  if (!data) return null

  const hasAlerts = data.pending_activation.length > 0 || data.expiring_soon.length > 0 || data.expired.length > 0 || data.low_stock.length > 0

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-0.5">Resumen general del gimnasio</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Socios activos"  value={data.active_members}            icon={Users}       accent="green" onClick={() => navigate('/admin/clientes')} />
        <KpiCard label="Ingresos hoy"    value={data.today_checkins}            icon={LogIn}       accent="blue"  onClick={() => navigate('/admin/accesos')} />
        <KpiCard label="Por activar"     value={data.pending_activation.length} icon={Clock}       accent={data.pending_activation.length > 0 ? 'amber' : 'gray'} />
        <KpiCard label="Stock bajo"      value={data.low_stock.length}          icon={Package}     accent={data.low_stock.length > 0 ? 'red' : 'gray'}   onClick={() => navigate('/admin/stock')} />
      </div>

      {!hasAlerts && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="bg-green-50 rounded-full p-4">
            <CheckCircle size={28} className="text-green-500" />
          </div>
          <p className="text-gray-600 font-medium">Todo en orden</p>
          <p className="text-sm text-gray-400">No hay alertas pendientes.</p>
        </div>
      )}

      {hasAlerts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Pending activation */}
          {data.pending_activation.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionHeader title="Pendientes de activación" count={data.pending_activation.length} icon={Clock} color="text-amber-500" />
              <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
                {data.pending_activation.map((c, i) => (
                  <div key={c.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-amber-700">{(c.nombre?.[0] ?? c.email[0]).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{c.nombre ?? '—'} {c.apellido ?? ''}</p>
                      <p className="text-xs text-gray-400 truncate">DNI {c.dni ?? 'sin completar'} · {c.email}</p>
                    </div>
                    <button
                      onClick={() => handleHabilitar(c.id)}
                      className="shrink-0 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-3 py-1.5 transition-colors font-medium"
                    >
                      Activar
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Expiring soon */}
          {data.expiring_soon.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionHeader title="Vencen en ≤7 días" count={data.expiring_soon.length} icon={AlertTriangle} color="text-amber-400" />
              <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
                {data.expiring_soon.map((m, i) => (
                  <div key={m.membresia_id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                    <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-amber-600">{(m.cliente_nombre?.[0] ?? '?').toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{m.cliente_nombre} {m.cliente_apellido}</p>
                      <p className="text-xs text-gray-400">{m.plan_nombre} · vence {m.fecha_vencimiento}</p>
                    </div>
                    <span className="shrink-0 text-xs font-bold text-amber-600 bg-amber-50 rounded-full px-2.5 py-1">
                      {m.dias_restantes}d
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Expired */}
          {data.expired.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionHeader title="Cuotas vencidas" count={data.expired.length} icon={XCircle} color="text-red-500" />
              <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
                {data.expired.map((m, i) => (
                  <div key={m.membresia_id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                    <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-red-500">{(m.cliente_nombre?.[0] ?? '?').toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{m.cliente_nombre} {m.cliente_apellido}</p>
                      <p className="text-xs text-gray-400">{m.plan_nombre} · venció {m.fecha_vencimiento}</p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-red-500 bg-red-50 rounded-full px-2.5 py-1">
                      hace {m.dias_vencida}d
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Low stock */}
          {data.low_stock.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionHeader title="Stock bajo" count={data.low_stock.length} icon={Package} color="text-red-400" />
              <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
                {data.low_stock.map((p, i) => (
                  <div key={p.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                    <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                      <Package size={14} className="text-red-400" />
                    </div>
                    <p className="flex-1 text-sm font-medium">{p.nombre}</p>
                    <span className={`shrink-0 text-xs font-bold rounded-full px-2.5 py-1 ${p.stock === 0 ? 'bg-red-100 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                      {p.stock === 0 ? 'Sin stock' : `${p.stock} uds.`}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>
      )}
    </div>
  )
}
