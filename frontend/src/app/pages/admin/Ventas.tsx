import { useEffect, useState, useMemo } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Check, Search, UserCheck } from 'lucide-react'
import { adminVentasApi, adminClientesApi, adminProductosApi, type VentaProducto, type Producto } from '../../api'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

type ClienteResuelto = { id: string; nombre: string | null; apellido: string | null; dni: string | null }

export default function AdminVentas() {
  const [ventas, setVentas] = useState<VentaProducto[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [showForm, setShowForm] = useState(false)
  const [filtroPagado, setFiltroPagado] = useState<'' | 'true' | 'false'>('')
  const [form, setForm] = useState({ cliente_id: '', producto_id: '', cantidad: '1', pagado: false })
  const [loading, setLoading] = useState(true)

  const [dniInput, setDniInput] = useState('')
  const [dniCliente, setDniCliente] = useState<ClienteResuelto | null>(null)
  const [dniError, setDniError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filterProducto, setFilterProducto] = useState('')

  async function load() {
    try {
      const params = filtroPagado !== '' ? { pagado: filtroPagado === 'true' } : undefined
      const [v, p] = await Promise.all([adminVentasApi.list(params), adminProductosApi.list()])
      setVentas(v); setProductos(p)
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  async function buscarPorDni(dni: string) {
    const trimmed = dni.trim()
    if (!trimmed) return
    try {
      const results = await adminClientesApi.list(trimmed)
      const match = results.find(c => c.dni === trimmed)
      if (match) {
        setDniCliente(match)
        setForm(f => ({ ...f, cliente_id: match.id }))
        setDniError('')
      } else {
        setDniCliente(null)
        setForm(f => ({ ...f, cliente_id: '' }))
        setDniError('No se encontró ningún cliente con ese DNI')
      }
    } catch {
      setDniError('Error al buscar cliente')
    }
  }

  useEffect(() => { load() }, [filtroPagado])

  function resetForm() {
    setShowForm(false)
    setForm({ cliente_id: '', producto_id: '', cantidad: '1', pagado: false })
    setDniInput('')
    setDniCliente(null)
    setDniError('')
  }

  const filtered = useMemo(() => {
    return ventas.filter(v => {
      if (busqueda) {
        const q = busqueda.toLowerCase()
        const name = `${v.cliente_nombre ?? ''} ${v.cliente_apellido ?? ''}`.toLowerCase()
        if (!name.includes(q)) return false
      }
      if (filterProducto && v.producto_id !== filterProducto) return false
      return true
    })
  }, [ventas, busqueda, filterProducto])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    try {
      await adminVentasApi.create({ cliente_id: form.cliente_id, producto_id: form.producto_id, cantidad: parseInt(form.cantidad), pagado: form.pagado })
      toast.success('Venta registrada')
      resetForm(); load()
    } catch (e: any) { toast.error(e.message) }
  }

  async function handlePagar(id: string) {
    try { await adminVentasApi.marcarPagado(id); toast.success('Marcado como pagado'); load() }
    catch (e: any) { toast.error(e.message) }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Cancelar venta? El stock será repuesto.')) return
    try { await adminVentasApi.delete(id); toast.success('Venta cancelada'); load() }
    catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ventas de productos</h1>
        <button onClick={() => showForm ? resetForm() : setShowForm(true)} className="flex items-center gap-1.5 bg-black text-white text-sm rounded-lg px-4 py-2 hover:bg-gray-800 transition-colors">
          <Plus size={16} /> Nueva venta
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-100 rounded-xl p-4 flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">DNI del cliente</label>
            <div className="flex gap-2">
              <input
                value={dniInput}
                onChange={e => { setDniInput(e.target.value); setDniCliente(null); setDniError(''); setForm(f => ({ ...f, cliente_id: '' })) }}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), buscarPorDni(dniInput))}
                onBlur={() => buscarPorDni(dniInput)}
                placeholder="Ej: 40123456"
                className="w-36 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
              />
            </div>
            {dniCliente && (
              <span className="flex items-center gap-1 text-xs text-green-700 mt-0.5">
                <UserCheck size={12} /> {dniCliente.nombre} {dniCliente.apellido}
              </span>
            )}
            {dniError && <span className="text-xs text-red-500 mt-0.5">{dniError}</span>}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Producto</label>
            <select value={form.producto_id} onChange={e => setForm(f => ({ ...f, producto_id: e.target.value }))} required className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Seleccionar...</option>
              {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} (stock: {p.stock})</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Cantidad</label>
            <input type="number" min="1" value={form.cantidad} onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))} required className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 mb-0.5">
            <input type="checkbox" checked={form.pagado} onChange={e => setForm(f => ({ ...f, pagado: e.target.checked }))} className="rounded" />
            Pagado al momento
          </label>
          <button type="submit" disabled={!form.cliente_id} className="bg-black text-white text-sm rounded-lg px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed">Registrar</button>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {(['', 'false', 'true'] as const).map(v => (
            <button key={v} onClick={() => setFiltroPagado(v)} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filtroPagado === v ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
              {v === '' ? 'Todas' : v === 'false' ? 'Pendientes' : 'Pagadas'}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[160px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar cliente..."
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>

        <select
          value={filterProducto}
          onChange={e => setFilterProducto(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
        >
          <option value="">Todos los productos</option>
          {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>

      {loading ? <p className="text-sm text-gray-400">Cargando...</p> : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Producto</th>
                <th className="px-4 py-3 text-left">Cant.</th>
                <th className="px-4 py-3 text-left">Total</th>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(v => (
                <tr key={v.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium">{v.cliente_nombre} {v.cliente_apellido}</td>
                  <td className="px-4 py-3 text-gray-600">{v.producto_nombre}</td>
                  <td className="px-4 py-3 text-gray-500">{v.cantidad}</td>
                  <td className="px-4 py-3 font-semibold">${(v.precio_unitario * v.cantidad).toLocaleString('es-AR')}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{format(parseISO(v.fecha_venta), 'd MMM HH:mm', { locale: es })}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${v.pagado ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {v.pagado ? 'Pagado' : 'Pendiente'}
                    </span>
                  </td>
                  <td className="px-4 py-3 flex items-center gap-2 justify-end">
                    {!v.pagado && (
                      <button onClick={() => handlePagar(v.id)} title="Marcar pagado" className="text-gray-400 hover:text-green-600 transition-colors"><Check size={15} /></button>
                    )}
                    <button onClick={() => handleDelete(v.id)} title="Cancelar" className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">Sin resultados</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
