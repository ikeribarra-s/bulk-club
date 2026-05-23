import { useState, useEffect } from "react";
import { toast } from "sonner";
import { api } from "../api";
import type { Proveedor } from "../api";
import Button from "../components/Button";
import Input from "../components/Input";
import Textarea from "../components/Textarea";
import Modal from "../components/Modal";

const emptyProveedor = { nombre: '', contacto: '', telefono: '', email: '', notas: '' };

export default function Proveedores() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState<Proveedor | null>(null);
  const [deletingProveedor, setDeletingProveedor] = useState<Proveedor | null>(null);
  const [nuevoProveedor, setNuevoProveedor] = useState(emptyProveedor);
  const [saving, setSaving] = useState(false);

  const load = () =>
    api.get('/proveedores/')
      .then(setProveedores)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!nuevoProveedor.nombre) { toast.error('Nombre es obligatorio'); return; }
    setSaving(true);
    try {
      const p = await api.post('/proveedores/', nuevoProveedor) as Proveedor;
      setProveedores((prev) => [p, ...prev]);
      setNuevoProveedor(emptyProveedor);
      setShowForm(false);
      toast.success('Proveedor creado');
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const handleSaveEdit = async () => {
    if (!editingProveedor) return;
    setSaving(true);
    try {
      const { id, created_at, updated_at, ...rest } = editingProveedor;
      const updated = await api.put(`/proveedores/${id}`, rest) as Proveedor;
      setProveedores((prev) => prev.map((p) => (p.id === id ? updated : p)));
      setEditingProveedor(null);
      toast.success('Proveedor actualizado');
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingProveedor) return;
    setSaving(true);
    try {
      await api.delete(`/proveedores/${deletingProveedor.id}`);
      setProveedores((prev) => prev.filter((p) => p.id !== deletingProveedor.id));
      setDeletingProveedor(null);
      toast.success('Proveedor eliminado');
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const formFields = (data: typeof emptyProveedor, set: (v: any) => void) => (
    <div className="space-y-4">
      <Input label="Nombre" value={data.nombre} onChange={(e) => set({ ...data, nombre: e.target.value })} required />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Contacto" value={data.contacto} onChange={(e) => set({ ...data, contacto: e.target.value })} />
        <Input label="Teléfono" value={data.telefono} onChange={(e) => set({ ...data, telefono: e.target.value })} />
      </div>
      <Input label="Email" type="email" value={data.email} onChange={(e) => set({ ...data, email: e.target.value })} />
      <Textarea label="Notas" value={data.notas} onChange={(e) => set({ ...data, notas: e.target.value })} />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Proveedores</h1>
        <Button variant="primary" onClick={() => setShowForm(true)}>+ Nuevo proveedor</Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse h-16" />)}</div>
      ) : proveedores.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">No hay proveedores registrados.</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Contacto</th>
                <th className="px-4 py-3 font-medium">Teléfono</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {proveedores.map((p) => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.nombre}</td>
                  <td className="px-4 py-3 text-gray-600">{p.contacto ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.telefono ? (
                      <a href={`https://wa.me/${p.telefono.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-green-600 hover:underline">{p.telefono}</a>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <Button variant="secondary" className="text-xs px-3 py-1" onClick={() => setEditingProveedor(p)}>Editar</Button>
                      <Button variant="danger" className="text-xs px-3 py-1" onClick={() => setDeletingProveedor(p)}>Eliminar</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Nuevo proveedor">
        <div className="space-y-4">
          {formFields(nuevoProveedor, setNuevoProveedor)}
          <div className="flex gap-3 pt-2">
            <Button variant="primary" onClick={handleCreate} className="flex-1" disabled={saving}>{saving ? 'Guardando...' : 'Crear proveedor'}</Button>
            <Button variant="secondary" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
          </div>
        </div>
      </Modal>

      {editingProveedor && (
        <Modal isOpen={true} onClose={() => setEditingProveedor(null)} title="Editar proveedor">
          <div className="space-y-4">
            {formFields(editingProveedor as any, setEditingProveedor)}
            <div className="flex gap-3 pt-2">
              <Button variant="primary" onClick={handleSaveEdit} className="flex-1" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</Button>
              <Button variant="secondary" onClick={() => setEditingProveedor(null)} className="flex-1">Cancelar</Button>
            </div>
          </div>
        </Modal>
      )}

      {deletingProveedor && (
        <Modal isOpen={true} onClose={() => setDeletingProveedor(null)} title="¿Eliminar proveedor?" className="max-w-md">
          <div className="space-y-4">
            <p className="text-gray-700">¿Eliminar <strong>{deletingProveedor.nombre}</strong>?</p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800">Falla si el proveedor tiene compras registradas.</p>
            </div>
            <div className="flex gap-3">
              <Button variant="danger" onClick={handleDelete} className="flex-1" disabled={saving}>{saving ? 'Eliminando...' : 'Sí, eliminar'}</Button>
              <Button variant="secondary" onClick={() => setDeletingProveedor(null)} className="flex-1">Cancelar</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
