import { useEffect, useState, useMemo } from 'react'
import { toast } from 'sonner'
import { RefreshCw, Trash2, Plus, Search } from 'lucide-react'
import { adminMembresiasApi, adminClientesApi, adminPanosApi, type Membresia, type Cliente, type Plan } from '../../api'

export default function AdminMembresias() {
  const [membresias, setMembresias] = useState<Membresia[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [planes, setPlanes] = useState<Plan[]>([])
  const [estado, setEstado] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filterPlan, setFilterPlan] = useState('')
  const [showForm, setShowForm] = useState(false)

  function defaultDates() {
    const today = new Date()
    const plus30 = new Date(today)
    plus30.setDate(plus30.getDate() + 30)
    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    return { fecha_inicio: fmt(today), fecha_vencimiento: fmt(plus30) }
  }

  const [form, setForm] = useState({ cliente_id: '', plan_id: '', ...defaultDates() })
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const [m, c, p] = await Promise.all([
        adminMembresiasApi.list(estado ? { estado } : undefined),
        adminClientesApi.list(),
        adminPanosApi.list(),
      ])
      setMembresias(m); setClientes(c); setPlanes(p)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [estado])

  const filtered = useMemo(() => {
    return membresias.filter(m => {
      if (busqueda) {
        const q = busqueda.toLowerCase()
        const name = `${m.cliente_nombre ?? ''} ${m.cliente_apellido ?? ''} ${m.cliente_dni ?? ''}`.toLowerCase()
        if (!name.includes(q)) return false
      }
      if (filterPlan && m.plan_id !== filterPlan) return false
      return true
    })
  }, [membresias, busqueda, filterPlan])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    try {
      await adminMembresiasApi.create(form)
      toast.success('Membresía creada')
      setShowForm(false)
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  async function handleRenovar(id: string) {
    try {
      await adminMembresiasApi.renovar(id)
      toast.success('Renovada por 30 días desde hoy')
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar membresía?')) return
    try {
      await adminMembresiasApi.delete(id)
      toast.success('Eliminada')
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Membresías</h1>
        <button onClick={() => { setForm(f => ({ ...f, ...defaultDates() })); setShowForm(!showForm) }} className="flex items-center gap-1.5 bg-black text-white text-sm rounded-lg px-4 py-2 hover:bg-gray-800 transition-colors">
          <Plus size={16} /> Nueva
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {['', 'activa', 'vencida', 'por_vencer'].map(e => (
            <button key={e} onClick={() => setEstado(e)} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${estado === e ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
              {e === '' ? 'Todas' : e === 'activa' ? 'Activas' : e === 'vencida' ? 'Vencidas' : 'Por vencer'}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar cliente o DNI..."
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>

        <select
          value={filterPlan}
          onChange={e => setFilterPlan(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
        >
          <option value="">Todos los planes</option>
          {planes.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-100 rounded-xl p-4 flex flex-wrap gap-3">
          <select value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))} required className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="">Cliente</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>)}
          </select>
          <select value={form.plan_id} onChange={e => setForm(f => ({ ...f, plan_id: e.target.value }))} required className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="">Plan</option>
            {planes.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <input type="date" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} required className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <input type="date" value={form.fecha_vencimiento} onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} required className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <button type="submit" className="bg-black text-white text-sm rounded-lg px-4 py-2">Guardar</button>
        </form>
      )}

      {loading ? <p className="text-sm text-gray-400">Cargando...</p> : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Plan</th>
                <th className="px-4 py-3 text-left">Vencimiento</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(m => (
                <tr key={m.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium">{m.cliente_nombre} {m.cliente_apellido}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-gray-700 font-medium">{m.plan_nombre}</span>
                      {m.activa ? (
                        <span className="text-xs text-green-600">
                          Activa · {Math.ceil((new Date(m.fecha_vencimiento).getTime() - Date.now()) / 86_400_000)} días restantes
                        </span>
                      ) : (
                        <span className="text-xs text-red-500">Vencida · {m.fecha_vencimiento}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{m.fecha_vencimiento}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${m.activa ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {m.activa ? 'Activa' : 'Vencida'}
                    </span>
                  </td>
                  <td className="px-4 py-3 flex items-center gap-2 justify-end">
                    <button onClick={() => handleRenovar(m.id)} title="Renovar 30 días" className="text-gray-400 hover:text-black transition-colors">
                      <RefreshCw size={15} />
                    </button>
                    <button onClick={() => handleDelete(m.id)} title="Eliminar" className="text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">Sin resultados</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
