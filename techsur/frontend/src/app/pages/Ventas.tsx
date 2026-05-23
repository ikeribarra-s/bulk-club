import { useState, useEffect, useMemo } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, parseDecimal } from "../api";
import type { Venta, Producto, Cliente } from "../api";
import { formatCurrency, formatDate } from "../lib/utils";
import StatusBadge from "../components/StatusBadge";
import Button from "../components/Button";
import Input from "../components/Input";
import Select from "../components/Select";
import Textarea from "../components/Textarea";
import Modal from "../components/Modal";

function formatPrecio(precio: string, moneda: 'ARS' | 'USD') {
  const n = parseDecimal(precio);
  if (moneda === 'USD') return `U$S ${n.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`;
  return formatCurrency(n);
}

const emptyForm = {
  producto_id: '',
  cliente_id: '',
  cantidad: '1',
  precio_final: '',
  moneda: 'ARS',
  forma_pago: 'efectivo',
  monto_permuta: '0',
  notas: '',
};

export default function Ventas() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [allProductos, setAllProductos] = useState<Producto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingVenta, setDeletingVenta] = useState<Venta | null>(null);

  const [form, setForm] = useState(emptyForm);

  const loadData = () =>
    Promise.all([
      api.get('/ventas/'),
      api.get('/productos/'),   // all products for name lookup in the table
      api.get('/clientes/'),
    ])
      .then(([v, p, c]) => { setVentas(v); setAllProductos(p); setClientes(c); })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));

  useEffect(() => { loadData(); }, []);

  // Products available to sell in the form
  const productosDisponibles = useMemo(
    () => allProductos.filter((p) => p.cantidad > 0 && p.estado !== 'vendido'),
    [allProductos]
  );

  // O(1) lookup for the sales table
  const productosMap = useMemo(
    () => new Map(allProductos.map((p) => [p.id, p])),
    [allProductos]
  );

  const selectedProducto = productosDisponibles.find((p) => p.id === form.producto_id);
  const cantidadDisponible = selectedProducto?.cantidad ?? 0;
  const cantidadNum = parseInt(form.cantidad) || 1;

  const handleCreate = async () => {
    if (!form.producto_id || !form.precio_final) {
      toast.error('Producto y precio final son obligatorios');
      return;
    }
    if (cantidadNum < 1) {
      toast.error('La cantidad debe ser al menos 1');
      return;
    }
    if (cantidadNum > cantidadDisponible) {
      toast.error(`Stock insuficiente: hay ${cantidadDisponible} unidad(es) disponible(s)`);
      return;
    }
    setSaving(true);
    try {
      const venta = await api.post('/ventas/', {
        producto_id: form.producto_id,
        cliente_id: form.cliente_id || undefined,
        cantidad: cantidadNum,
        precio_final: parseFloat(form.precio_final),
        moneda: form.moneda,
        forma_pago: form.forma_pago,
        monto_permuta: parseFloat(form.monto_permuta) || 0,
        notas: form.notas || undefined,
      }) as Venta;

      setVentas((prev) => [venta, ...prev]);

      // Update local stock: reduce quantity, mark as vendido if hits 0
      setAllProductos((prev) => prev.map((p) => {
        if (p.id !== form.producto_id) return p;
        const newQty = p.cantidad - cantidadNum;
        return { ...p, cantidad: newQty, estado: newQty <= 0 ? 'vendido' : p.estado };
      }));

      setForm(emptyForm);
      setShowForm(false);
      toast.success('Venta registrada');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVenta = async () => {
    if (!deletingVenta) return;
    setSaving(true);
    try {
      await api.delete(`/ventas/${deletingVenta.id}`);
      setVentas((prev) => prev.filter((v) => v.id !== deletingVenta.id));
      // Reload products so restored stock reflects correctly
      const productos = await api.get('/productos/') as Producto[];
      setAllProductos(productos);
      setDeletingVenta(null);
      toast.success('Venta eliminada — stock restaurado');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const getClienteNombre = (id: string | null) => {
    if (!id) return '—';
    const c = clientes.find((c) => c.id === id);
    return c ? `${c.nombre} ${c.apellido ?? ''}`.trim() : '—';
  };

  const totalARS = ventas.filter((v) => v.moneda === 'ARS').reduce((s, v) => s + parseDecimal(v.precio_final), 0);
  const totalUSD = ventas.filter((v) => v.moneda === 'USD').reduce((s, v) => s + parseDecimal(v.precio_final), 0);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Ventas</h1>
        <div className="bg-white rounded-lg border border-gray-200 p-8 animate-pulse h-40" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Ventas</h1>
        <Button variant="primary" onClick={() => setShowForm(true)}>+ Registrar venta</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <p className="text-sm text-gray-500">Total ventas</p>
          <p className="text-2xl font-bold text-gray-900">{ventas.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <p className="text-sm text-gray-500">Unidades vendidas</p>
          <p className="text-2xl font-bold text-gray-900">{ventas.reduce((s, v) => s + v.cantidad, 0)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <p className="text-sm text-gray-500">Ingresos ARS</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalARS)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <p className="text-sm text-gray-500">Ingresos USD</p>
          <p className="text-2xl font-bold text-gray-900">
            {totalUSD > 0 ? `U$S ${totalUSD.toLocaleString('es-AR')}` : '—'}
          </p>
        </div>
      </div>

      {ventas.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
          No hay ventas registradas aún.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium text-center">Cant.</th>
                  <th className="px-4 py-3 font-medium">Precio final</th>
                  <th className="px-4 py-3 font-medium">Pago</th>
                  <th className="px-4 py-3 font-medium">Permuta</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((v) => {
                  const prod = productosMap.get(v.producto_id);
                  const subtitle = [prod?.storage, prod?.color, prod?.bateria_salud != null ? `Bat. ${prod.bateria_salud}%` : null]
                    .filter(Boolean).join(' · ');
                  return (
                    <tr key={v.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">
                          {prod?.nombre ?? `Producto ${v.producto_id.slice(0, 8)}`}
                        </p>
                        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{getClienteNombre(v.cliente_id)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-semibold text-gray-800">{v.cantidad}</span>
                        {v.cantidad > 1 && (
                          <p className="text-[10px] text-gray-400 leading-none mt-0.5">
                            {formatPrecio(String(parseDecimal(v.precio_final) / v.cantidad), v.moneda)} c/u
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        {formatPrecio(v.precio_final, v.moneda)}
                        {v.moneda === 'USD' && (
                          <span className="ml-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">USD</span>
                        )}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={v.forma_pago as any} /></td>
                      <td className="px-4 py-3 text-gray-600">
                        {parseDecimal(v.monto_permuta) > 0 ? formatCurrency(parseDecimal(v.monto_permuta)) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(v.fecha_venta)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setDeletingVenta(v)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Eliminar venta"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create venta modal */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setForm(emptyForm); }} title="Registrar venta">
        <div className="space-y-4">
          <Select
            label="Producto disponible"
            required
            options={[
              { value: '', label: 'Seleccionar producto...' },
              ...productosDisponibles.map((p) => ({
                value: p.id,
                label: `${p.nombre}${p.storage ? ` · ${p.storage}` : ''}${p.color ? ` · ${p.color}` : ''} (stock: ${p.cantidad})`,
              })),
            ]}
            value={form.producto_id}
            onChange={(e) => {
              const p = productosDisponibles.find((x) => x.id === e.target.value);
              setForm({ ...form, producto_id: e.target.value, precio_final: p ? String(parseDecimal(p.precio_venta)) : form.precio_final, cantidad: '1' });
            }}
          />

          {selectedProducto && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              <p className="font-medium text-blue-800">{selectedProducto.nombre}</p>
              <p className="text-blue-600">
                Precio sugerido: {formatCurrency(parseDecimal(selectedProducto.precio_venta))}
                {selectedProducto.condicion !== 'nuevo' && selectedProducto.bateria_salud
                  ? ` · Batería: ${selectedProducto.bateria_salud}%`
                  : ''}
              </p>
              <p className="text-blue-700 font-semibold mt-1">
                Stock disponible: {selectedProducto.cantidad} unidad{selectedProducto.cantidad !== 1 ? 'es' : ''}
              </p>
            </div>
          )}

          <Select
            label="Cliente (opcional)"
            options={[
              { value: '', label: 'Sin cliente registrado' },
              ...clientes.map((c) => ({ value: c.id, label: `${c.nombre} ${c.apellido ?? ''}`.trim() })),
            ]}
            value={form.cliente_id}
            onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                label="Cantidad a vender"
                type="number"
                min={1}
                max={cantidadDisponible || undefined}
                value={form.cantidad}
                onChange={(e) => {
                  const qty = parseInt(e.target.value) || 1;
                  const unitPrice = selectedProducto ? parseDecimal(selectedProducto.precio_venta) : null;
                  setForm({
                    ...form,
                    cantidad: e.target.value,
                    ...(unitPrice != null ? { precio_final: String(unitPrice * qty) } : {}),
                  });
                }}
                required
              />
              {selectedProducto && cantidadNum > 1 && cantidadNum <= cantidadDisponible && (
                <p className="text-xs text-gray-500 mt-1">
                  Quedarán {cantidadDisponible - cantidadNum} en stock
                </p>
              )}
              {selectedProducto && cantidadNum > cantidadDisponible && (
                <p className="text-xs text-red-500 mt-1">
                  Stock insuficiente
                </p>
              )}
            </div>
            <Select
              label="Moneda"
              options={[
                { value: 'ARS', label: 'Pesos (ARS)' },
                { value: 'USD', label: 'Dólares (USD)' },
              ]}
              value={form.moneda}
              onChange={(e) => setForm({ ...form, moneda: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Input
                label={`Precio total (${form.moneda})`}
                type="number"
                required
                value={form.precio_final}
                onChange={(e) => setForm({ ...form, precio_final: e.target.value })}
              />
              {selectedProducto && cantidadNum > 1 && form.precio_final && (
                <p className="text-xs text-gray-500 mt-1">
                  {formatPrecio(String(parseDecimal(form.precio_final) / cantidadNum), form.moneda as 'ARS' | 'USD')} × {cantidadNum} u.
                </p>
              )}
            </div>
            <Select
              label="Forma de pago"
              options={[
                { value: 'efectivo', label: 'Efectivo' },
                { value: 'transferencia', label: 'Transferencia' },
                { value: 'tarjeta', label: 'Tarjeta' },
                { value: 'mixto', label: 'Mixto' },
              ]}
              value={form.forma_pago}
              onChange={(e) => setForm({ ...form, forma_pago: e.target.value })}
            />
          </div>

          {form.forma_pago === 'mixto' && (
            <Input
              label="Monto por permuta ($)"
              type="number"
              value={form.monto_permuta}
              onChange={(e) => setForm({ ...form, monto_permuta: e.target.value })}
              placeholder="Valor del equipo recibido en parte de pago"
            />
          )}

          <Textarea label="Notas (opcional)" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />

          <div className="flex gap-3 pt-2">
            <Button variant="primary" onClick={handleCreate} className="flex-1" disabled={saving || cantidadNum > cantidadDisponible}>
              {saving ? 'Guardando...' : 'Registrar venta'}
            </Button>
            <Button variant="secondary" onClick={() => { setShowForm(false); setForm(emptyForm); }} className="flex-1">
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete venta confirmation */}
      {deletingVenta && (() => {
        const prod = productosMap.get(deletingVenta.producto_id);
        return (
          <Modal isOpen={true} onClose={() => setDeletingVenta(null)} title="¿Eliminar venta?" className="max-w-md">
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm space-y-1">
                <p className="font-medium text-gray-900">{prod?.nombre ?? 'Producto'}</p>
                <p className="text-gray-600">
                  {deletingVenta.cantidad} unidad{deletingVenta.cantidad !== 1 ? 'es' : ''} ·{' '}
                  {formatPrecio(deletingVenta.precio_final, deletingVenta.moneda)} ·{' '}
                  {formatDate(deletingVenta.fecha_venta)}
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  El stock del producto se restaurará automáticamente ({deletingVenta.cantidad} unidad{deletingVenta.cantidad !== 1 ? 'es' : ''} de vuelta).
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="danger" onClick={handleDeleteVenta} className="flex-1" disabled={saving}>
                  {saving ? 'Eliminando...' : 'Sí, eliminar'}
                </Button>
                <Button variant="secondary" onClick={() => setDeletingVenta(null)} className="flex-1">
                  Cancelar
                </Button>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
