import { useEffect, useState, useMemo } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { adminProductosApi, type Producto } from '../../api'

export default function AdminStock() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Producto | null>(null)
  const [form, setForm] = useState({ nombre: '', descripcion: '', precio: '', stock: '0' })
  const [loading, setLoading] = useState(true)

  const [busqueda, setBusqueda] = useState('')
  const [filterStock, setFilterStock] = useState<'' | 'bajo' | 'sin'>('')

  async function load() {
    try { setProductos(await adminProductosApi.list()) }
    catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    return productos.filter(p => {
      if (busqueda && !p.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false
      if (filterStock === 'sin' && p.stock !== 0) return false
      if (filterStock === 'bajo' && (p.stock === 0 || p.stock > 3)) return false
      return true
    })
  }, [productos, busqueda, filterStock])

  function startEdit(p: Producto) {
    setEditing(p)
    setForm({ nombre: p.nombre, descripcion: p.descripcion ?? '', precio: String(p.precio), stock: String(p.stock) })
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const body = { nombre: form.nombre, descripcion: form.descripcion || undefined, precio: parseFloat(form.precio), stock: parseInt(form.stock) }
    try {
      if (editing) {
        await adminProductosApi.update(editing.id, body)
        toast.success('Producto actualizado')
      } else {
        await adminProductosApi.create(body)
        toast.success('Producto creado')
      }
      setShowForm(false); setEditing(null); setForm({ nombre: '', descripcion: '', precio: '', stock: '0' }); load()
    } catch (e: any) { toast.error(e.message) }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar producto?')) return
    try { await adminProductosApi.delete(id); toast.success('Eliminado'); load() }
    catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Stock</h1>
        <button onClick={() => { setShowForm(!showForm); setEditing(null) }} className="flex items-center gap-1.5 bg-black text-white text-sm rounded-lg px-4 py-2 hover:bg-gray-800 transition-colors">
          <Plus size={16} /> Nuevo
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-100 rounded-xl p-4 flex flex-wrap gap-3">
          <input placeholder="Nombre" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <input placeholder="Descripción (opcional)" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <input type="number" step="0.01" placeholder="Precio" value={form.precio} onChange={e => setForm(f => ({ ...f, precio: e.target.value }))} required className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <input type="number" placeholder="Stock" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} required className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <button type="submit" className="bg-black text-white text-sm rounded-lg px-4 py-2">{editing ? 'Actualizar' : 'Crear'}</button>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>
        <div className="flex gap-1.5">
          {([['', 'Todos'], ['bajo', 'Stock bajo (≤3)'], ['sin', 'Sin stock']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilterStock(val)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterStock === val ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <p className="text-sm text-gray-400">Cargando...</p> : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Producto</th>
                <th className="px-4 py-3 text-left">Precio</th>
                <th className="px-4 py-3 text-left">Stock</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <p className="font-medium">{p.nombre}</p>
                    {p.descripcion && <p className="text-xs text-gray-400">{p.descripcion}</p>}
                  </td>
                  <td className="px-4 py-3 font-semibold">${Number(p.precio).toLocaleString('es-AR')}</td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${p.stock === 0 ? 'text-red-600' : p.stock <= 3 ? 'text-amber-500' : 'text-green-600'}`}>{p.stock}</span>
                  </td>
                  <td className="px-4 py-3 flex items-center gap-2 justify-end">
                    <button onClick={() => startEdit(p)} className="text-gray-400 hover:text-black transition-colors"><Pencil size={15} /></button>
                    <button onClick={() => handleDelete(p.id)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">Sin resultados</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
