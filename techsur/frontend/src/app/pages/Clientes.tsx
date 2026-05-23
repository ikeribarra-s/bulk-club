import { useState, useEffect } from "react";
import { toast } from "sonner";
import { api } from "../api";
import type { Cliente } from "../api";
import Button from "../components/Button";
import Input from "../components/Input";
import Textarea from "../components/Textarea";
import Modal from "../components/Modal";

const emptyCliente = { nombre: '', apellido: '', dni: '', telefono: '', email: '', direccion: '', notas: '' };

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [deletingCliente, setDeletingCliente] = useState<Cliente | null>(null);
  const [nuevoCliente, setNuevoCliente] = useState(emptyCliente);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = (q?: string) =>
    api.get('/clientes/', q ? { busqueda: q } : undefined)
      .then(setClientes)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(busqueda);
  };

  const handleCreate = async () => {
    if (!nuevoCliente.nombre) { toast.error('Nombre es obligatorio'); return; }
    setSaving(true);
    try {
      const c = await api.post('/clientes/', nuevoCliente) as Cliente;
      setClientes((prev) => [c, ...prev]);
      setNuevoCliente(emptyCliente);
      setShowForm(false);
      toast.success('Cliente creado');
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const handleSaveEdit = async () => {
    if (!editingCliente) return;
    setSaving(true);
    try {
      const { id, created_at, updated_at, ...rest } = editingCliente;
      const updated = await api.put(`/clientes/${id}`, rest) as Cliente;
      setClientes((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setEditingCliente(null);
      toast.success('Cliente actualizado');
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingCliente) return;
    setSaving(true);
    try {
      await api.delete(`/clientes/${deletingCliente.id}`);
      setClientes((prev) => prev.filter((c) => c.id !== deletingCliente.id));
      setDeletingCliente(null);
      toast.success('Cliente eliminado');
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Clientes</h1>
        <Button variant="primary" onClick={() => setShowForm(true)}>+ Nuevo cliente</Button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          placeholder="Buscar por nombre, apellido o DNI..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="max-w-sm"
        />
        <Button type="submit" variant="secondary">Buscar</Button>
        {busqueda && <Button type="button" variant="ghost" onClick={() => { setBusqueda(''); load(); }}>Limpiar</Button>}
      </form>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : clientes.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
          No hay clientes registrados.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">DNI</th>
                <th className="px-4 py-3 font-medium">Teléfono</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {c.nombre} {c.apellido ?? ''}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.dni ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {c.telefono ? (
                      <a href={`https://wa.me/${c.telefono.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-green-600 hover:underline">{c.telefono}</a>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <Button variant="secondary" className="text-xs px-3 py-1" onClick={() => setEditingCliente(c)}>Editar</Button>
                      <Button variant="danger" className="text-xs px-3 py-1" onClick={() => setDeletingCliente(c)}>Eliminar</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Nuevo cliente">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Nombre" value={nuevoCliente.nombre} onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })} required />
            <Input label="Apellido" value={nuevoCliente.apellido} onChange={(e) => setNuevoCliente({ ...nuevoCliente, apellido: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="DNI" value={nuevoCliente.dni} onChange={(e) => setNuevoCliente({ ...nuevoCliente, dni: e.target.value })} />
            <Input label="Teléfono" value={nuevoCliente.telefono} onChange={(e) => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })} />
          </div>
          <Input label="Email" type="email" value={nuevoCliente.email} onChange={(e) => setNuevoCliente({ ...nuevoCliente, email: e.target.value })} />
          <Input label="Dirección" value={nuevoCliente.direccion} onChange={(e) => setNuevoCliente({ ...nuevoCliente, direccion: e.target.value })} />
          <Textarea label="Notas" value={nuevoCliente.notas} onChange={(e) => setNuevoCliente({ ...nuevoCliente, notas: e.target.value })} />
          <div className="flex gap-3 pt-2">
            <Button variant="primary" onClick={handleCreate} className="flex-1" disabled={saving}>
              {saving ? 'Guardando...' : 'Crear cliente'}
            </Button>
            <Button variant="secondary" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
          </div>
        </div>
      </Modal>

      {editingCliente && (
        <Modal isOpen={true} onClose={() => setEditingCliente(null)} title="Editar cliente">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Nombre" value={editingCliente.nombre} onChange={(e) => setEditingCliente({ ...editingCliente, nombre: e.target.value })} required />
              <Input label="Apellido" value={editingCliente.apellido ?? ''} onChange={(e) => setEditingCliente({ ...editingCliente, apellido: e.target.value || null })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="DNI" value={editingCliente.dni ?? ''} onChange={(e) => setEditingCliente({ ...editingCliente, dni: e.target.value || null })} />
              <Input label="Teléfono" value={editingCliente.telefono ?? ''} onChange={(e) => setEditingCliente({ ...editingCliente, telefono: e.target.value || null })} />
            </div>
            <Input label="Email" value={editingCliente.email ?? ''} onChange={(e) => setEditingCliente({ ...editingCliente, email: e.target.value || null })} />
            <Input label="Dirección" value={editingCliente.direccion ?? ''} onChange={(e) => setEditingCliente({ ...editingCliente, direccion: e.target.value || null })} />
            <Textarea label="Notas" value={editingCliente.notas ?? ''} onChange={(e) => setEditingCliente({ ...editingCliente, notas: e.target.value || null })} />
            <div className="flex gap-3 pt-2">
              <Button variant="primary" onClick={handleSaveEdit} className="flex-1" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </Button>
              <Button variant="secondary" onClick={() => setEditingCliente(null)} className="flex-1">Cancelar</Button>
            </div>
          </div>
        </Modal>
      )}

      {deletingCliente && (
        <Modal isOpen={true} onClose={() => setDeletingCliente(null)} title="¿Eliminar cliente?" className="max-w-md">
          <div className="space-y-4">
            <p className="text-gray-700">¿Eliminar a <strong>{deletingCliente.nombre} {deletingCliente.apellido ?? ''}</strong>?</p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800">Falla si el cliente tiene ventas registradas.</p>
            </div>
            <div className="flex gap-3">
              <Button variant="danger" onClick={handleDelete} className="flex-1" disabled={saving}>
                {saving ? 'Eliminando...' : 'Sí, eliminar'}
              </Button>
              <Button variant="secondary" onClick={() => setDeletingCliente(null)} className="flex-1">Cancelar</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
