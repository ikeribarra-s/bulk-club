import { useEffect, useState, useMemo } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Search } from 'lucide-react'
import { adminPagosApi, adminClientesApi, adminMembresiasApi, type Pago, type Cliente, type Membresia } from '../../api'

const FORMAS = ['efectivo', 'transferencia', 'tarjeta'] as const

export default function AdminPagos() {
  const [pagos, setPagos] = useState<Pago[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [membresias, setMembresias] = useState<Membresia[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ cliente_id: '', membresia_id: '', monto: '', fecha_pago: new Date().toISOString().slice(0, 10), forma_pago: 'efectivo', notas: '' })
  const [loading, setLoading] = useState(true)

  // filters
  const [busqueda, setBusqueda] = useState('')
  const [filterForma, setFilterForma] = useState('')
  const [filterDesde, setFilterDesde] = useState('')
  const [filterHasta, setFilterHasta] = useState('')

  async function load() {
    try {
      const [p, c, m] = await Promise.all([adminPagosApi.list(), adminClientesApi.list(), adminMembresiasApi.list()])
      setPagos(p); setClientes(c); setMembresias(m)
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    return pagos.filter(p => {
      if (busqueda) {
        const q = busqueda.toLowerCase()
        const name = `${p.cliente_nombre ?? ''} ${p.cliente_apellido ?? ''}`.toLowerCase()
        if (!name.includes(q)) return false
      }
      if (filterForma && p.forma_pago !== filterForma) return false
      if (filterDesde && p.fecha_pago < filterDesde) return false
      if (filterHasta && p.fecha_pago > filterHasta) return false
      return true
    })
  }, [pagos, busqueda, filterForma, filterDesde, filterHasta])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    try {
      await adminPagosApi.create({ ...form, monto: parseFloat(form.monto), membresia_id: form.membresia_id || undefined })
      toast.success('Pago registrado')
      setShowForm(false)
      load()
    } catch (e: any) { toast.error(e.message) }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar pago?')) return
    try { await adminPagosApi.delete(id); toast.success('Eliminado'); load() }
    catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pagos</h1>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 bg-black text-white text-sm rounded-lg px-4 py-2 hover:bg-gray-800 transition-colors">
          <Plus size={16} /> Registrar
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-100 rounded-xl p-4 flex flex-wrap gap-3">
          <select value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))} required className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="">Cliente</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>)}
          </select>
          <select value={form.membresia_id} onChange={e => setForm(f => ({ ...f, membresia_id: e.target.value }))} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="">Membresía (opcional)</option>
            {membresias.filter(m => m.cliente_id === form.cliente_id).map(m => <option key={m.id} value={m.id}>{m.plan_nombre} — {m.fecha_vencimiento}</option>)}
          </select>
          <input type="number" step="0.01" placeholder="Monto" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} required className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-32" />
          <input type="date" value={form.fecha_pago} onChange={e => setForm(f => ({ ...f, fecha_pago: e.target.value }))} required className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <select value={form.forma_pago} onChange={e => setForm(f => ({ ...f, forma_pago: e.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="tarjeta">Tarjeta</option>
          </select>
          <button type="submit" className="bg-black text-white text-sm rounded-lg px-4 py-2">Guardar</button>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar cliente..."
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>

        <div className="flex gap-1.5">
          {(['', ...FORMAS] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterForma(f)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors capitalize ${filterForma === f ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}
            >
              {f === '' ? 'Todos' : f}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500">
          <input
            type="date"
            value={filterDesde}
            onChange={e => setFilterDesde(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
          />
          <span className="text-gray-300">→</span>
          <input
            type="date"
            value={filterHasta}
            onChange={e => setFilterHasta(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
          />
          {(filterDesde || filterHasta) && (
            <button onClick={() => { setFilterDesde(''); setFilterHasta('') }} className="text-xs text-gray-400 hover:text-black transition-colors">
              Limpiar
            </button>
          )}
        </div>
      </div>

      {loading ? <p className="text-sm text-gray-400">Cargando...</p> : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-left">Monto</th>
                <th className="px-4 py-3 text-left">Forma</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium">{p.cliente_nombre} {p.cliente_apellido}</td>
                  <td className="px-4 py-3 text-gray-500">{p.fecha_pago}</td>
                  <td className="px-4 py-3 font-semibold">${Number(p.monto).toLocaleString('es-AR')}</td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{p.forma_pago}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(p.id)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={15} /></button>
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
