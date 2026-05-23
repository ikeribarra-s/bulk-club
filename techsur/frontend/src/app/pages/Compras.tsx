import { useState, useEffect } from "react";
import { toast } from "sonner";
import { api, parseDecimal } from "../api";
import type { Compra, Producto, Proveedor } from "../api";
import { formatCurrency, formatDate } from "../lib/utils";
import StatusBadge from "../components/StatusBadge";
import Button from "../components/Button";
import Input from "../components/Input";
import Select from "../components/Select";
import Textarea from "../components/Textarea";
import Modal from "../components/Modal";

export default function Compras() {
  const [compras, setCompras] = useState<Compra[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    proveedor_id: '',
    producto_id: '',
    cantidad: '1',
    precio_unitario: '',
    fecha_compra: today,
    forma_pago: 'efectivo',
    notas: '',
  });

  useEffect(() => {
    Promise.all([
      api.get('/compras/'),
      api.get('/productos/'),
      api.get('/proveedores/'),
    ])
      .then(([c, p, pr]) => { setCompras(c); setProductos(p); setProveedores(pr); })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!form.producto_id || !form.precio_unitario || !form.fecha_compra) {
      toast.error('Producto, precio y fecha son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const c = await api.post('/compras/', {
        proveedor_id: form.proveedor_id || undefined,
        producto_id: form.producto_id,
        cantidad: parseInt(form.cantidad) || 1,
        precio_unitario: parseFloat(form.precio_unitario),
        fecha_compra: form.fecha_compra,
        forma_pago: form.forma_pago,
        notas: form.notas || undefined,
      }) as Compra;
      setCompras((prev) => [c, ...prev]);
      setForm({ proveedor_id: '', producto_id: '', cantidad: '1', precio_unitario: '', fecha_compra: today, forma_pago: 'efectivo', notas: '' });
      setShowForm(false);
      toast.success('Compra registrada');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const getProductoNombre = (id: string) => productos.find((p) => p.id === id)?.nombre ?? id.slice(0, 8);
  const getProveedorNombre = (id: string | null) => {
    if (!id) return '—';
    return proveedores.find((p) => p.id === id)?.nombre ?? id.slice(0, 8);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Compras</h1>
        <Button variant="primary" onClick={() => setShowForm(true)}>+ Registrar compra</Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <p className="text-sm text-gray-500">Total compras</p>
          <p className="text-2xl font-bold text-gray-900">{compras.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <p className="text-sm text-gray-500">Invertido total</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(compras.reduce((s, c) => s + parseDecimal(c.precio_unitario) * c.cantidad, 0))}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 animate-pulse h-40" />
      ) : compras.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">No hay compras registradas.</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-4 py-3 font-medium">Proveedor</th>
                  <th className="px-4 py-3 font-medium text-center">Cant.</th>
                  <th className="px-4 py-3 font-medium">Precio unit.</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Pago</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {compras.map((c) => (
                  <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{getProductoNombre(c.producto_id)}</td>
                    <td className="px-4 py-3 text-gray-600">{getProveedorNombre(c.proveedor_id)}</td>
                    <td className="px-4 py-3 text-center text-gray-700">{c.cantidad}</td>
                    <td className="px-4 py-3 text-gray-700">{formatCurrency(parseDecimal(c.precio_unitario))}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{formatCurrency(parseDecimal(c.precio_unitario) * c.cantidad)}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.forma_pago as any} /></td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(c.fecha_compra)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Registrar compra">
        <div className="space-y-4">
          <Select
            label="Producto"
            required
            options={[
              { value: '', label: 'Seleccionar producto...' },
              ...productos.map((p) => ({ value: p.id, label: `${p.nombre} · ${p.estado}` })),
            ]}
            value={form.producto_id}
            onChange={(e) => setForm({ ...form, producto_id: e.target.value })}
          />
          <Select
            label="Proveedor (opcional)"
            options={[
              { value: '', label: 'Sin proveedor' },
              ...proveedores.map((p) => ({ value: p.id, label: p.nombre })),
            ]}
            value={form.proveedor_id}
            onChange={(e) => setForm({ ...form, proveedor_id: e.target.value })}
          />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input label="Cantidad" type="number" min={1} required value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
            <Input label="Precio unitario ($)" type="number" required value={form.precio_unitario} onChange={(e) => setForm({ ...form, precio_unitario: e.target.value })} />
            <Input label="Fecha" type="date" required value={form.fecha_compra} onChange={(e) => setForm({ ...form, fecha_compra: e.target.value })} />
            <Select
              label="Forma de pago"
              options={[
                { value: 'efectivo', label: 'Efectivo' },
                { value: 'transferencia', label: 'Transferencia' },
                { value: 'tarjeta', label: 'Tarjeta' },
              ]}
              value={form.forma_pago}
              onChange={(e) => setForm({ ...form, forma_pago: e.target.value })}
            />
          </div>
          <Textarea label="Notas" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
          <div className="flex gap-3 pt-2">
            <Button variant="primary" onClick={handleCreate} className="flex-1" disabled={saving}>
              {saving ? 'Guardando...' : 'Registrar compra'}
            </Button>
            <Button variant="secondary" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
