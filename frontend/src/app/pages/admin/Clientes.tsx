import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Search, UserCheck, UserX, Trash2, Pencil, RefreshCw } from 'lucide-react'
import { adminClientesApi, adminMembresiasApi, adminPanosApi, type ClienteConPlan, type Plan } from '../../api'

type CreateForm = { nombre: string; apellido: string; email: string; telefono: string; dni: string; password: string }
type EditForm = { nombre: string; apellido: string; telefono: string; dni: string; plan_id: string }
type RenovarForm = { forma_pago: 'efectivo' | 'transferencia' | 'tarjeta' }

const emptyCreate = (): CreateForm => ({ nombre: '', apellido: '', email: '', telefono: '', dni: '', password: '' })

export default function AdminClientes() {
  const [clientes, setClientes] = useState<ClienteConPlan[]>([])
  const [planes, setPlanes] = useState<Plan[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)

  const [editTarget, setEditTarget] = useState<ClienteConPlan | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ nombre: '', apellido: '', telefono: '', dni: '', plan_id: '' })
  const [editSaving, setEditSaving] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreate())
  const [createSaving, setCreateSaving] = useState(false)

  const [renovarTarget, setRenovarTarget] = useState<ClienteConPlan | null>(null)
  const [renovarForm, setRenovarForm] = useState<RenovarForm>({ forma_pago: 'efectivo' })
  const [renovarSaving, setRenovarSaving] = useState(false)

  async function load() {
    try {
      const [c, p] = await Promise.all([
        adminClientesApi.list(busqueda || undefined),
        planes.length ? Promise.resolve(planes) : adminPanosApi.list(),
      ])
      setClientes(c)
      if (!planes.length) setPlanes(p)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [busqueda])

  async function toggleHabilitar(c: ClienteConPlan) {
    try {
      if (c.habilitado) {
        await adminClientesApi.deshabilitar(c.id)
        toast.success('Cliente deshabilitado')
      } else {
        await adminClientesApi.habilitar(c.id)
        toast.success('Cliente habilitado')
      }
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este cliente?')) return
    try {
      await adminClientesApi.delete(id)
      toast.success('Cliente eliminado')
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  async function handleCreate() {
    if (!createForm.dni) return
    setCreateSaving(true)
    try {
      await adminClientesApi.create({
        nombre: createForm.nombre || undefined,
        apellido: createForm.apellido || undefined,
        email: createForm.email || undefined,
        telefono: createForm.telefono || undefined,
        dni: createForm.dni,
        password: createForm.password || undefined,
      })
      toast.success('Cliente creado')
      setCreateOpen(false)
      setCreateForm(emptyCreate())
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setCreateSaving(false)
    }
  }

  function openEdit(c: ClienteConPlan) {
    setEditTarget(c)
    setEditForm({
      nombre: c.nombre ?? '',
      apellido: c.apellido ?? '',
      telefono: c.telefono ?? '',
      dni: c.dni ?? '',
      plan_id: c.plan_id ?? '',
    })
  }

  async function handleEditSave() {
    if (!editTarget) return
    setEditSaving(true)
    try {
      await adminClientesApi.update(editTarget.id, {
        nombre: editForm.nombre || undefined,
        apellido: editForm.apellido || undefined,
        telefono: editForm.telefono || undefined,
        dni: editForm.dni || undefined,
      })
      if (editTarget.membresia_id && editForm.plan_id && editForm.plan_id !== (editTarget.plan_id ?? '')) {
        await adminMembresiasApi.update(editTarget.membresia_id, { plan_id: editForm.plan_id })
      }
      toast.success('Cliente actualizado')
      setEditTarget(null)
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setEditSaving(false)
    }
  }

  async function handleRenovar() {
    if (!renovarTarget) return
    setRenovarSaving(true)
    try {
      const res = await adminClientesApi.renovar(renovarTarget.id, renovarForm.forma_pago)
      toast.success(`Membresía renovada hasta ${res.nueva_fecha_vencimiento} — $${res.monto_pagado}`)
      setRenovarTarget(null)
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setRenovarSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <button
          onClick={() => { setCreateForm(emptyCreate()); setCreateOpen(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
        >
          <UserCheck size={15} /> Nuevo cliente
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, DNI o email..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
        />
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">DNI</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Plan</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Cuota</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {clientes.map(c => (
                <tr key={c.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium">{c.nombre} {c.apellido}</td>
                  <td className="px-4 py-3 text-gray-500">{c.dni ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 truncate max-w-[160px]">{c.email}</td>
                  <td className="px-4 py-3">
                    {c.plan_nombre ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-gray-700">{c.plan_nombre}</span>
                        {c.fecha_vencimiento && (
                          <span className={`text-xs ${c.membresia_activa ? 'text-green-600' : 'text-red-500'}`}>
                            {c.membresia_activa ? 'Activa' : 'Vencida'} · {c.fecha_vencimiento}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">Sin plan</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${c.habilitado ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.habilitado ? 'Habilitado' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.membresia_id && !c.membresia_activa ? (
                      <button
                        onClick={() => setRenovarTarget(c)}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                      >
                        <RefreshCw size={12} /> Renovar
                      </button>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 flex items-center gap-2 justify-end">
                    <button
                      onClick={() => openEdit(c)}
                      title="Editar"
                      className="text-gray-400 hover:text-black transition-colors"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => toggleHabilitar(c)}
                      title={c.habilitado ? 'Deshabilitar' : 'Habilitar'}
                      className="text-gray-400 hover:text-black transition-colors"
                    >
                      {c.habilitado ? <UserX size={15} /> : <UserCheck size={15} />}
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      title="Eliminar"
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {clientes.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-4">
            <h2 className="text-lg font-semibold">Nuevo cliente</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Nombre</label>
                <input value={createForm.nombre} onChange={e => setCreateForm(p => ({ ...p, nombre: e.target.value }))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Apellido</label>
                <input value={createForm.apellido} onChange={e => setCreateForm(p => ({ ...p, apellido: e.target.value }))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">DNI <span className="text-red-400">*</span></label>
              <input value={createForm.dni} onChange={e => setCreateForm(p => ({ ...p, dni: e.target.value }))}
                placeholder="Sin puntos ni espacios"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Email</label>
              <input type="email" value={createForm.email} onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Teléfono</label>
              <input value={createForm.telefono} onChange={e => setCreateForm(p => ({ ...p, telefono: e.target.value }))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Contraseña <span className="text-gray-400 font-normal">(por defecto: el DNI)</span></label>
              <input type="password" value={createForm.password} onChange={e => setCreateForm(p => ({ ...p, password: e.target.value }))}
                placeholder="Dejar vacío para usar el DNI"
                autoComplete="new-password"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10" />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setCreateOpen(false)}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors">
                Cancelar
              </button>
              <button onClick={handleCreate} disabled={createSaving || !createForm.dni}
                className="px-4 py-2 rounded-lg text-sm bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50">
                {createSaving ? 'Creando...' : 'Crear cliente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-4">
            <h2 className="text-lg font-semibold">Editar cliente</h2>
            <div className="grid grid-cols-2 gap-3">
              {(['nombre', 'apellido'] as const).map(f => (
                <div key={f} className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500 capitalize">{f}</label>
                  <input
                    value={editForm[f]}
                    onChange={e => setEditForm(p => ({ ...p, [f]: e.target.value }))}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                  />
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Teléfono</label>
              <input
                value={editForm.telefono}
                onChange={e => setEditForm(p => ({ ...p, telefono: e.target.value }))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">DNI</label>
              <input
                value={editForm.dni}
                onChange={e => setEditForm(p => ({ ...p, dni: e.target.value }))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
              />
            </div>
            {editTarget?.membresia_id && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Plan</label>
                <select
                  value={editForm.plan_id}
                  onChange={e => setEditForm(p => ({ ...p, plan_id: e.target.value }))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                >
                  {planes.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
            )}
            <div className="flex gap-2 justify-between pt-2">
              <button
                onClick={async () => {
                  if (!editTarget) return
                  try {
                    await adminClientesApi.resetPassword(editTarget.id)
                    toast.success('Contraseña restablecida al DNI')
                  } catch (e: any) { toast.error(e.message) }
                }}
                className="px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Restablecer contraseña al DNI
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditTarget(null)}
                  className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEditSave}
                  disabled={editSaving}
                  className="px-4 py-2 rounded-lg text-sm bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {editSaving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Renovar modal */}
      {renovarTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4">
            <h2 className="text-lg font-semibold">Renovar membresía</h2>
            <p className="text-sm text-gray-500">
              {renovarTarget.nombre} {renovarTarget.apellido} · <span className="font-medium text-gray-700">{renovarTarget.plan_nombre}</span>
            </p>
            <p className="text-xs text-gray-400">Se registrará un pago automático y la vigencia se extenderá 30 días desde hoy.</p>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Forma de pago</label>
              <select
                value={renovarForm.forma_pago}
                onChange={e => setRenovarForm({ forma_pago: e.target.value as RenovarForm['forma_pago'] })}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
              >
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta">Tarjeta</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setRenovarTarget(null)}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRenovar}
                disabled={renovarSaving}
                className="px-4 py-2 rounded-lg text-sm bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {renovarSaving ? 'Procesando...' : 'Renovar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
