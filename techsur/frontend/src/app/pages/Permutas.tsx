import { useState, useEffect } from "react";
import { toast } from "sonner";
import { api, parseDecimal } from "../api";
import type { Permuta, Cliente, VentaLabel } from "../api";
import { formatCurrency, formatDate } from "../lib/utils";
import StatusBadge from "../components/StatusBadge";
import Button from "../components/Button";
import Input from "../components/Input";
import Select from "../components/Select";
import Textarea from "../components/Textarea";
import Modal from "../components/Modal";

const STORAGE_OPTIONS = ['64GB', '128GB', '256GB', '512GB', '1TB'];
const MARCA_OPTIONS = ['Apple', 'Samsung', 'Xiaomi', 'Motorola', 'Google', 'Otro'];

const emptyForm = {
  venta_id: '',
  cliente_id: '',
  marca: 'Apple',
  modelo: '',
  storage: '',
  color: '',
  condicion: 'bueno' as const,
  bateria_salud: '',
  valor_permuta: '',
  notas: '',
};

export default function Permutas() {
  const [permutas, setPermutas] = useState<Permuta[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [ventaLabels, setVentaLabels] = useState<VentaLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    Promise.all([
      api.get('/permutas/'),
      api.get('/clientes/'),
      api.get('/ventas/labels'),
    ])
      .then(([p, c, vl]) => { setPermutas(p); setClientes(c); setVentaLabels(vl); })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!form.marca || !form.modelo || !form.valor_permuta) {
      toast.error('Marca, modelo y valor son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const p = await api.post('/permutas/', {
        venta_id: form.venta_id || undefined,
        cliente_id: form.cliente_id || undefined,
        marca: form.marca,
        modelo: form.modelo,
        storage: form.storage || undefined,
        color: form.color || undefined,
        condicion: form.condicion,
        bateria_salud: form.bateria_salud ? parseInt(form.bateria_salud) : undefined,
        valor_permuta: parseFloat(form.valor_permuta),
        notas: form.notas || undefined,
      }) as Permuta;
      setPermutas((prev) => [p, ...prev]);
      setForm(emptyForm);
      setShowForm(false);
      toast.success('Permuta registrada');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/permutas/${id}`);
      setPermutas((prev) => prev.filter((p) => p.id !== id));
      toast.success('Permuta eliminada');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const getClienteNombre = (id: string | null) => {
    if (!id) return '—';
    const c = clientes.find((c) => c.id === id);
    return c ? `${c.nombre} ${c.apellido ?? ''}`.trim() : '—';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Permutas</h1>
        <Button variant="primary" onClick={() => setShowForm(true)}>+ Registrar permuta</Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <p className="text-sm text-gray-500">Total permutas</p>
          <p className="text-2xl font-bold text-gray-900">{permutas.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <p className="text-sm text-gray-500">Valor total recibido</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(permutas.reduce((s, p) => s + parseDecimal(p.valor_permuta), 0))}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse h-20" />)}</div>
      ) : permutas.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">No hay permutas registradas.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {permutas.map((p) => (
            <div key={p.id} className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{p.marca} {p.modelo}</p>
                  <p className="text-sm text-gray-500">
                    {p.storage ? `${p.storage} · ` : ''}{p.color ? `${p.color} · ` : ''}<StatusBadge status={p.condicion} />
                  </p>
                </div>
                <p className="text-xl font-bold text-[#2563EB]">{formatCurrency(parseDecimal(p.valor_permuta))}</p>
              </div>
              {p.bateria_salud != null && (
                <p className="text-xs text-gray-500">Batería: {p.bateria_salud}%</p>
              )}
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>Cliente: {getClienteNombre(p.cliente_id)}</span>
                <span>{formatDate(p.created_at)}</span>
              </div>
              {p.notas && <p className="text-xs text-gray-400 italic">{p.notas}</p>}
              <Button variant="danger" className="text-xs px-3 py-1 mt-1" onClick={() => handleDelete(p.id)}>
                Eliminar
              </Button>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Registrar permuta">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="Marca" options={MARCA_OPTIONS.map((m) => ({ value: m, label: m }))} value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} />
            <Input label="Modelo" required value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} placeholder="ej: iPhone 13" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select label="Storage" options={[{ value: '', label: '—' }, ...STORAGE_OPTIONS.map((s) => ({ value: s, label: s }))]} value={form.storage} onChange={(e) => setForm({ ...form, storage: e.target.value })} />
            <Input label="Color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            <Select
              label="Condición"
              options={[{ value: 'bueno', label: 'Bueno' }, { value: 'regular', label: 'Regular' }, { value: 'malo', label: 'Malo' }]}
              value={form.condicion}
              onChange={(e) => setForm({ ...form, condicion: e.target.value as any })}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Batería (%)" type="number" min={0} max={100} value={form.bateria_salud} onChange={(e) => setForm({ ...form, bateria_salud: e.target.value })} />
            <Input label="Valor permuta ($)" type="number" required value={form.valor_permuta} onChange={(e) => setForm({ ...form, valor_permuta: e.target.value })} />
          </div>
          <Select
            label="Cliente (opcional)"
            options={[{ value: '', label: 'Sin cliente' }, ...clientes.map((c) => ({ value: c.id, label: `${c.nombre} ${c.apellido ?? ''}`.trim() }))]}
            value={form.cliente_id}
            onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
          />
          <Select
            label="Asociar a venta (opcional)"
            options={[{ value: '', label: 'Sin venta asociada' }, ...ventaLabels.map((v) => ({ value: v.id, label: v.label }))]}
            value={form.venta_id}
            onChange={(e) => setForm({ ...form, venta_id: e.target.value })}
          />
          <Textarea label="Notas" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
          <div className="flex gap-3 pt-2">
            <Button variant="primary" onClick={handleCreate} className="flex-1" disabled={saving}>
              {saving ? 'Guardando...' : 'Registrar permuta'}
            </Button>
            <Button variant="secondary" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
