import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { adminPanosApi, type Plan } from '../../api'

type PlanForm = { nombre: string; dias_por_semana: string; precio_mensual: string; descripcion: string; activo: boolean }

const emptyForm = (): PlanForm => ({ nombre: '', dias_por_semana: '', precio_mensual: '', descripcion: '', activo: true })

export default function AdminPlanes() {
  const [planes, setPlanes] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [modalTarget, setModalTarget] = useState<Plan | 'new' | null>(null)
  const [form, setForm] = useState<PlanForm>(emptyForm())
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      setPlanes(await adminPanosApi.list())
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setForm(emptyForm())
    setModalTarget('new')
  }

  function openEdit(p: Plan) {
    setForm({
      nombre: p.nombre,
      dias_por_semana: p.dias_por_semana != null ? String(p.dias_por_semana) : '',
      precio_mensual: String(p.precio_mensual),
      descripcion: p.descripcion ?? '',
      activo: p.activo,
    })
    setModalTarget(p)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        nombre: form.nombre,
        dias_por_semana: form.dias_por_semana !== '' ? Number(form.dias_por_semana) : null,
        precio_mensual: Number(form.precio_mensual),
        descripcion: form.descripcion || null,
        activo: form.activo,
      }
      if (modalTarget === 'new') {
        await adminPanosApi.create(payload)
        toast.success('Plan creado')
      } else if (modalTarget) {
        await adminPanosApi.update((modalTarget as Plan).id, payload)
        toast.success('Plan actualizado')
      }
      setModalTarget(null)
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este plan?')) return
    try {
      await adminPanosApi.delete(id)
      toast.success('Plan eliminado')
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Planes</h1>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Plus size={15} /> Nuevo plan
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Días/semana</th>
                <th className="px-4 py-3 text-left">Precio mensual</th>
                <th className="px-4 py-3 text-left">Descripción</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {planes.map(p => (
                <tr key={p.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium">{p.nombre}</td>
                  <td className="px-4 py-3 text-gray-500">{p.dias_por_semana != null ? p.dias_por_semana : 'Ilimitado'}</td>
                  <td className="px-4 py-3 text-gray-700 font-medium">${p.precio_mensual.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[220px] truncate">{p.descripcion ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${p.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 flex items-center gap-2 justify-end">
                    <button
                      onClick={() => openEdit(p)}
                      title="Editar"
                      className="text-gray-400 hover:text-black transition-colors"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      title="Eliminar"
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {planes.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">Sin planes creados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalTarget !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-4">
            <h2 className="text-lg font-semibold">{modalTarget === 'new' ? 'Nuevo plan' : 'Editar plan'}</h2>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Nombre *</label>
              <input
                value={form.nombre}
                onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                placeholder="ej. Full, 3 días/semana"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Días/semana (vacío = ilimitado)</label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={form.dias_por_semana}
                  onChange={e => setForm(p => ({ ...p, dias_por_semana: e.target.value }))}
                  placeholder="ej. 3"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Precio mensual *</label>
                <input
                  type="number"
                  min={0}
                  value={form.precio_mensual}
                  onChange={e => setForm(p => ({ ...p, precio_mensual: e.target.value }))}
                  placeholder="ej. 15000"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Descripción</label>
              <input
                value={form.descripcion}
                onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                placeholder="Opcional"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
              />
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={e => setForm(p => ({ ...p, activo: e.target.checked }))}
                className="rounded"
              />
              Plan activo
            </label>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setModalTarget(null)}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.nombre || !form.precio_mensual}
                className="px-4 py-2 rounded-lg text-sm bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
