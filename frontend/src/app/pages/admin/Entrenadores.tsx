import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Users, X, Search, ChevronDown, ChevronUp, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import {
  adminEntrenadoresApi, adminClientesApi,
  type Entrenador, type EntrenadorCliente, type ClienteConPlan,
} from '../../api'

function CreateTrainerModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!username.trim() || !password.trim()) return
    setSaving(true)
    try {
      await adminEntrenadoresApi.create(username.trim(), password.trim())
      toast.success('Entrenador creado')
      onCreated()
      onClose()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Nuevo entrenador</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">Usuario</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-black transition-colors" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-black transition-colors" onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }} />
          </div>
        </div>
        <div className="px-5 pb-5">
          <button onClick={handleSave} disabled={saving || !username.trim() || !password.trim()} className="w-full bg-black text-white py-2.5 rounded-xl font-medium text-sm hover:opacity-80 disabled:opacity-40 transition-opacity">
            {saving ? 'Creando…' : 'Crear entrenador'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AssignClientModal({
  trainerId,
  onClose,
  onAssigned,
}: {
  trainerId: string
  onClose: () => void
  onAssigned: () => void
}) {
  const [search, setSearch] = useState('')
  const [clients, setClients] = useState<ClienteConPlan[]>([])
  const [loading, setLoading] = useState(false)
  const [assigning, setAssigning] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    adminClientesApi.list(search || undefined)
      .then((all) => setClients(all.filter((c) => !c.trainer_id)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [search])

  async function assign(clientId: string) {
    setAssigning(clientId)
    try {
      await adminEntrenadoresApi.assignCliente(trainerId, clientId)
      toast.success('Cliente asignado')
      onAssigned()
      onClose()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setAssigning(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Asignar cliente</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2">
            <Search size={14} className="text-gray-400" />
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o DNI…" className="flex-1 text-sm outline-none" />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
          {loading && <p className="text-sm text-gray-400 text-center py-6">Cargando…</p>}
          {!loading && clients.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">{search ? 'Sin resultados' : 'Todos los clientes tienen entrenador asignado'}</p>
          )}
          {clients.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
              <div>
                <p className="text-sm font-medium text-gray-900">{[c.nombre, c.apellido].filter(Boolean).join(' ') || '—'}</p>
                <p className="text-xs text-gray-400">{c.dni ?? c.email ?? ''}</p>
              </div>
              <button onClick={() => assign(c.id)} disabled={assigning === c.id} className="text-xs bg-black text-white px-3 py-1.5 rounded-lg hover:opacity-80 disabled:opacity-40 transition-opacity">
                {assigning === c.id ? '…' : 'Asignar'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TrainerRow({
  trainer,
  onRefresh,
}: {
  trainer: Entrenador
  onRefresh: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [clients, setClients] = useState<EntrenadorCliente[]>([])
  const [loadingClients, setLoadingClients] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [editUsername, setEditUsername] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  async function loadClients() {
    setLoadingClients(true)
    try {
      setClients(await adminEntrenadoresApi.getClientes(trainer.id))
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoadingClients(false)
    }
  }

  function handleExpand() {
    if (!expanded) loadClients()
    setExpanded((v) => !v)
  }

  async function handleUnassign(clientId: string) {
    try {
      await adminEntrenadoresApi.unassignCliente(trainer.id, clientId)
      setClients((prev) => prev.filter((c) => c.id !== clientId))
      onRefresh()
      toast.success('Cliente desasignado')
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar al entrenador ${trainer.username}? Se desasignarán sus clientes.`)) return
    try {
      await adminEntrenadoresApi.delete(trainer.id)
      onRefresh()
      toast.success('Entrenador eliminado')
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  async function handleSaveUsername() {
    if (!editUsername.trim()) return
    setSaving(true)
    try {
      await adminEntrenadoresApi.update(trainer.id, editUsername.trim())
      onRefresh()
      setEditing(false)
      toast.success('Nombre actualizado')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white font-bold shrink-0">
          {trainer.username[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveUsername(); if (e.key === 'Escape') setEditing(false) }}
                className="border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-black"
              />
              <button onClick={handleSaveUsername} disabled={saving} className="text-xs bg-black text-white px-2 py-1 rounded-lg disabled:opacity-40">{saving ? '…' : 'Guardar'}</button>
              <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-700">Cancelar</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-900">{trainer.username}</p>
              <button onClick={() => { setEditUsername(trainer.username); setEditing(true) }} className="text-gray-300 hover:text-gray-600 transition-colors"><Pencil size={13} /></button>
            </div>
          )}
          <p className="text-xs text-gray-400">{trainer.client_count} {trainer.client_count === 1 ? 'cliente' : 'clientes'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowAssign(true) }}
            className="flex items-center gap-1.5 text-xs bg-black text-white px-3 py-1.5 rounded-lg hover:opacity-80 transition-opacity"
          >
            <Plus size={13} /> Asignar cliente
          </button>
          <button onClick={handleExpand} className="text-gray-400 hover:text-gray-700 p-1">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button onClick={handleDelete} className="text-gray-300 hover:text-red-500 transition-colors p-1">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-5 py-3">
          {loadingClients && <p className="text-sm text-gray-400 py-2">Cargando…</p>}
          {!loadingClients && clients.length === 0 && (
            <p className="text-sm text-gray-400 py-2">Sin clientes asignados.</p>
          )}
          <div className="space-y-2">
            {clients.map((c) => {
              const name = [c.nombre, c.apellido].filter(Boolean).join(' ') || 'Sin nombre'
              return (
                <div key={c.id} className="flex items-center gap-3">
                  {c.foto_url
                    ? <img src={c.foto_url} className="w-7 h-7 rounded-full object-cover shrink-0" alt={name} />
                    : <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-500 shrink-0">{name[0]?.toUpperCase()}</div>
                  }
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{name}</p>
                    {c.dni && <p className="text-xs text-gray-400">DNI {c.dni}</p>}
                  </div>
                  <button onClick={() => handleUnassign(c.id)} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Desasignar</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showAssign && (
        <AssignClientModal
          trainerId={trainer.id}
          onClose={() => setShowAssign(false)}
          onAssigned={() => { loadClients(); onRefresh() }}
        />
      )}
    </div>
  )
}

export default function AdminEntrenadores() {
  const [trainers, setTrainers] = useState<Entrenador[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setTrainers(await adminEntrenadoresApi.list())
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Entrenadores</h1>
          <p className="text-sm text-gray-400 mt-1">Gestioná las cuentas de entrenadores y sus clientes asignados.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-sm font-medium hover:opacity-80 transition-opacity"
        >
          <Plus size={16} /> Nuevo entrenador
        </button>
      </div>

      {loading && <p className="text-gray-400 text-sm">Cargando…</p>}
      {!loading && trainers.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p>Todavía no hay entrenadores.</p>
          <p className="text-sm mt-1">Creá el primero con el botón de arriba.</p>
        </div>
      )}

      <div className="space-y-3">
        {trainers.map((t) => (
          <TrainerRow key={t.id} trainer={t} onRefresh={load} />
        ))}
      </div>

      {showCreate && (
        <CreateTrainerModal onClose={() => setShowCreate(false)} onCreated={load} />
      )}
    </div>
  )
}
