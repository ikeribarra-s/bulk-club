import { useState, useEffect, useMemo } from "react";
import { Download, Search, X } from "lucide-react";
import { toast } from "sonner";
import { api, parseDecimal } from "../api";
import type { Producto } from "../api";
import { formatCurrency, exportCSV } from "../lib/utils";
import StatusBadge from "../components/StatusBadge";
import Button from "../components/Button";
import Input from "../components/Input";
import Select from "../components/Select";
import Textarea from "../components/Textarea";
import Modal from "../components/Modal";

const emptyProducto = {
  nombre: '',
  marca: 'Apple',
  modelo: '',
  storage: '',
  color: '',
  condicion: 'usado' as const,
  bateria_salud: '' as string | number,
  cantidad: '1',
  precio_compra: '',
  precio_venta: '',
  notas: '',
};

const PRESET_MARCAS = ['Apple', 'Samsung', 'Xiaomi', 'Motorola', 'Google'];
const PRESET_STORAGES = ['64GB', '128GB', '256GB', '512GB', '1TB'];
const MARCA_OPTIONS = [...PRESET_MARCAS, 'Otro'];
const STORAGE_OPTIONS = [...PRESET_STORAGES, 'Otro'];
const CONDICION_OPTS = [
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'usado', label: 'Usado' },
  { value: 'reacondicionado', label: 'Reacondicionado' },
];

function marcaSelectValue(marca: string) {
  return PRESET_MARCAS.includes(marca) ? marca : 'Otro';
}
function storageSelectValue(storage: string | null) {
  if (!storage) return '';
  return PRESET_STORAGES.includes(storage) ? storage : 'Otro';
}

export default function Inventario() {
  const [showForm, setShowForm] = useState(false);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterCondicion, setFilterCondicion] = useState('');
  const [filterMarca, setFilterMarca] = useState('');
  const [searchText, setSearchText] = useState('');

  const [editingProducto, setEditingProducto] = useState<Producto | null>(null);
  const [deletingProducto, setDeletingProducto] = useState<Producto | null>(null);
  const [nuevoProducto, setNuevoProducto] = useState(emptyProducto);
  const [saving, setSaving] = useState(false);

  const loadProductos = () =>
    api.get('/productos/')
      .then(setProductos)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));

  useEffect(() => { loadProductos(); }, []);

  const marcas = useMemo(
    () => [...new Set(productos.map((p) => p.marca))].sort(),
    [productos]
  );

  const inStock = useMemo(
    () => productos.filter((p) => p.cantidad > 0),
    [productos]
  );

  const filtered = useMemo(() => inStock.filter((p) => {
    if (filterCondicion && p.condicion !== filterCondicion) return false;
    if (filterMarca && p.marca !== filterMarca) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      return [p.nombre, p.modelo, p.marca, p.color, p.storage]
        .filter(Boolean)
        .some((f) => f!.toLowerCase().includes(q));
    }
    return true;
  }), [inStock, filterCondicion, filterMarca, searchText]);

  const hasFilters = !!filterCondicion || !!filterMarca || !!searchText;
  const clearFilters = () => { setFilterCondicion(''); setFilterMarca(''); setSearchText(''); };

  const totalSKUs = inStock.length;
  const totalUnidades = inStock.reduce((s, p) => s + p.cantidad, 0);
  const valorStock = inStock.reduce((s, p) => s + parseDecimal(p.precio_venta) * p.cantidad, 0);
  const lowStock = inStock.filter((p) => p.cantidad <= 2).length;

  const handleAgregar = async () => {
    if (!nuevoProducto.nombre || !nuevoProducto.modelo) {
      toast.error('Nombre y modelo son obligatorios');
      return;
    }
    if (!nuevoProducto.precio_compra || !nuevoProducto.precio_venta) {
      toast.error('Los precios son obligatorios');
      return;
    }
    if (!nuevoProducto.marca.trim()) {
      toast.error('La marca es obligatoria');
      return;
    }
    setSaving(true);
    try {
      const created = await api.post('/productos/', {
        nombre: nuevoProducto.nombre,
        marca: nuevoProducto.marca,
        modelo: nuevoProducto.modelo,
        storage: nuevoProducto.storage || undefined,
        color: nuevoProducto.color || undefined,
        condicion: nuevoProducto.condicion,
        bateria_salud: nuevoProducto.bateria_salud ? parseInt(String(nuevoProducto.bateria_salud)) : undefined,
        cantidad: parseInt(String(nuevoProducto.cantidad)) || 1,
        precio_compra: parseFloat(String(nuevoProducto.precio_compra)),
        precio_venta: parseFloat(String(nuevoProducto.precio_venta)),
        notas: nuevoProducto.notas || undefined,
      }) as Producto;
      setProductos((prev) => [created, ...prev]);
      setNuevoProducto(emptyProducto);
      setShowForm(false);
      toast.success('Producto agregado');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingProducto) return;
    if (!editingProducto.marca.trim()) {
      toast.error('La marca es obligatoria');
      return;
    }
    setSaving(true);
    try {
      const { id, created_at, updated_at, ...rest } = editingProducto;
      const updated = await api.put(`/productos/${id}`, {
        ...rest,
        precio_compra: parseFloat(String(rest.precio_compra)),
        precio_venta: parseFloat(String(rest.precio_venta)),
        bateria_salud: rest.bateria_salud ?? undefined,
      }) as Producto;
      setProductos((prev) => prev.map((p) => (p.id === id ? updated : p)));
      setEditingProducto(null);
      toast.success('Producto actualizado');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingProducto) return;
    setSaving(true);
    try {
      await api.delete(`/productos/${deletingProducto.id}`);
      setProductos((prev) => prev.filter((p) => p.id !== deletingProducto.id));
      setDeletingProducto(null);
      toast.success('Producto eliminado');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Inventario</h1>
          <div className="h-9 w-40 bg-gray-200 rounded-lg animate-pulse" />
        </div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 animate-pulse h-16" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Inventario</h1>
        <Button variant="primary" onClick={() => setShowForm(true)}>
          + Agregar Producto
        </Button>
      </div>

      <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <p className="text-sm text-gray-500">SKUs en stock</p>
              <p className="text-2xl font-bold text-gray-900">{totalSKUs}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <p className="text-sm text-gray-500">Unidades totales</p>
              <p className="text-2xl font-bold text-gray-900">{totalUnidades}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <p className="text-sm text-gray-500">Valor en stock</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(valorStock)}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <p className="text-sm text-gray-500">Stock bajo</p>
              <p className={`text-2xl font-bold ${lowStock > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{lowStock}</p>
            </div>
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Buscar por nombre, modelo, color..."
                className="w-full pl-9 pr-3 py-2 text-[16px] md:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
              />
              {searchText && (
                <button
                  onClick={() => setSearchText('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <Select
              options={[
                { value: '', label: 'Toda condición' },
                ...CONDICION_OPTS,
              ]}
              value={filterCondicion}
              onChange={(e) => setFilterCondicion(e.target.value)}
              className="w-44"
            />

            {marcas.length > 1 && (
              <Select
                options={[
                  { value: '', label: 'Toda marca' },
                  ...marcas.map((m) => ({ value: m, label: m })),
                ]}
                value={filterMarca}
                onChange={(e) => setFilterMarca(e.target.value)}
                className="w-40"
              />
            )}

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Limpiar
              </button>
            )}

            <Button
              variant="secondary"
              className="ml-auto"
              onClick={() => exportCSV(`inventario_${new Date().toISOString().slice(0, 10)}.csv`, filtered.map((p) => ({
                ID: p.id,
                Nombre: p.nombre,
                Marca: p.marca,
                Modelo: p.modelo,
                Storage: p.storage ?? '',
                Color: p.color ?? '',
                Condicion: p.condicion,
                Bateria: p.bateria_salud ?? '',
                Cantidad: p.cantidad,
                'Precio Compra': p.precio_compra,
                'Precio Venta': p.precio_venta,
              })))}
            >
              <Download className="w-4 h-4 mr-1 inline" /> Exportar CSV
            </Button>
          </div>

          {hasFilters && (
            <p className="text-sm text-gray-500">
              {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} de {inStock.length}
            </p>
          )}

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-gray-500">
                    <th className="px-4 py-3 font-medium">Producto</th>
                    <th className="px-4 py-3 font-medium">Condición</th>
                    <th className="px-4 py-3 font-medium text-center">Stock</th>
                    <th className="px-4 py-3 font-medium">Precio venta</th>
                    <th className="px-4 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                        {hasFilters ? 'Sin resultados para los filtros aplicados' : 'Sin productos en stock'}
                      </td>
                    </tr>
                  ) : filtered.map((producto) => (
                    <tr key={producto.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{producto.nombre}</p>
                        <p className="text-xs text-gray-500">
                          {producto.marca} · {producto.modelo}
                          {producto.storage ? ` · ${producto.storage}` : ''}
                          {producto.color ? ` · ${producto.color}` : ''}
                          {producto.bateria_salud != null ? ` · Bat. ${producto.bateria_salud}%` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={producto.condicion} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-lg font-bold ${
                          producto.cantidad <= 2 ? 'text-amber-600' : 'text-gray-900'
                        }`}>
                          {producto.cantidad}
                        </span>
                        {producto.cantidad <= 2 && (
                          <p className="text-[10px] text-amber-500 leading-none mt-0.5">stock bajo</p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        {formatCurrency(parseDecimal(producto.precio_venta))}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setEditingProducto(producto)}>
                            Editar
                          </Button>
                          <Button variant="ghost" className="px-2 py-1 text-xs text-red-600 hover:bg-red-50" onClick={() => setDeletingProducto(producto)}>
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
      </div>

      {showForm && (
        <Modal isOpen={true} onClose={() => { setShowForm(false); setNuevoProducto(emptyProducto); }} title="Agregar producto">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Nombre del producto" value={nuevoProducto.nombre} onChange={(e) => setNuevoProducto({ ...nuevoProducto, nombre: e.target.value })} placeholder="ej: iPhone 15 Pro 256GB" required />
              <div className="space-y-2">
                <Select
                  label="Marca"
                  options={MARCA_OPTIONS.map((m) => ({ value: m, label: m }))}
                  value={marcaSelectValue(nuevoProducto.marca)}
                  onChange={(e) => setNuevoProducto({ ...nuevoProducto, marca: e.target.value === 'Otro' ? '' : e.target.value })}
                />
                {marcaSelectValue(nuevoProducto.marca) === 'Otro' && (
                  <Input
                    placeholder="Escribí la marca..."
                    value={nuevoProducto.marca}
                    onChange={(e) => setNuevoProducto({ ...nuevoProducto, marca: e.target.value })}
                  />
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Modelo" value={nuevoProducto.modelo} onChange={(e) => setNuevoProducto({ ...nuevoProducto, modelo: e.target.value })} placeholder="ej: iPhone 15 Pro" required />
              <div className="space-y-2">
                <Select
                  label="Storage"
                  options={[{ value: '', label: '—' }, ...STORAGE_OPTIONS.map((s) => ({ value: s, label: s }))]}
                  value={storageSelectValue(nuevoProducto.storage)}
                  onChange={(e) => setNuevoProducto({ ...nuevoProducto, storage: e.target.value === 'Otro' ? '' : e.target.value })}
                />
                {storageSelectValue(nuevoProducto.storage) === 'Otro' && (
                  <Input
                    placeholder="ej: 32GB, 2TB..."
                    value={nuevoProducto.storage}
                    onChange={(e) => setNuevoProducto({ ...nuevoProducto, storage: e.target.value })}
                  />
                )}
              </div>
              <Input label="Color" value={String(nuevoProducto.color)} onChange={(e) => setNuevoProducto({ ...nuevoProducto, color: e.target.value })} placeholder="ej: Natural Titanium" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select label="Condición" options={CONDICION_OPTS} value={nuevoProducto.condicion} onChange={(e) => setNuevoProducto({ ...nuevoProducto, condicion: e.target.value as any })} />
              <Input label="Salud de batería (%)" type="number" min={0} max={100} value={String(nuevoProducto.bateria_salud)} onChange={(e) => setNuevoProducto({ ...nuevoProducto, bateria_salud: e.target.value })} placeholder="ej: 87" />
              <Input label="Cantidad en stock" type="number" min={1} value={String(nuevoProducto.cantidad)} onChange={(e) => setNuevoProducto({ ...nuevoProducto, cantidad: e.target.value })} required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Precio compra ($)" type="number" value={String(nuevoProducto.precio_compra)} onChange={(e) => setNuevoProducto({ ...nuevoProducto, precio_compra: e.target.value })} required />
              <Input label="Precio venta ($)" type="number" value={String(nuevoProducto.precio_venta)} onChange={(e) => setNuevoProducto({ ...nuevoProducto, precio_venta: e.target.value })} required />
            </div>
            <Textarea label="Notas" value={String(nuevoProducto.notas)} onChange={(e) => setNuevoProducto({ ...nuevoProducto, notas: e.target.value })} />
            <div className="flex gap-3 pt-2">
              <Button variant="primary" onClick={handleAgregar} className="flex-1" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar producto'}
              </Button>
              <Button variant="secondary" onClick={() => { setShowForm(false); setNuevoProducto(emptyProducto); }} className="flex-1">Cancelar</Button>
            </div>
          </div>
        </Modal>
      )}

      {editingProducto && (
        <Modal isOpen={true} onClose={() => setEditingProducto(null)} title="Editar producto">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Nombre" value={editingProducto.nombre} onChange={(e) => setEditingProducto({ ...editingProducto, nombre: e.target.value })} required />
              <div className="space-y-2">
                <Select
                  label="Marca"
                  options={MARCA_OPTIONS.map((m) => ({ value: m, label: m }))}
                  value={marcaSelectValue(editingProducto.marca)}
                  onChange={(e) => setEditingProducto({ ...editingProducto, marca: e.target.value === 'Otro' ? '' : e.target.value })}
                />
                {marcaSelectValue(editingProducto.marca) === 'Otro' && (
                  <Input
                    placeholder="Escribí la marca..."
                    value={editingProducto.marca}
                    onChange={(e) => setEditingProducto({ ...editingProducto, marca: e.target.value })}
                  />
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Modelo" value={editingProducto.modelo} onChange={(e) => setEditingProducto({ ...editingProducto, modelo: e.target.value })} />
              <div className="space-y-2">
                <Select
                  label="Storage"
                  options={[{ value: '', label: '—' }, ...STORAGE_OPTIONS.map((s) => ({ value: s, label: s }))]}
                  value={storageSelectValue(editingProducto.storage)}
                  onChange={(e) => setEditingProducto({ ...editingProducto, storage: e.target.value === 'Otro' ? '' : (e.target.value || null) })}
                />
                {storageSelectValue(editingProducto.storage) === 'Otro' && (
                  <Input
                    placeholder="ej: 32GB, 2TB..."
                    value={editingProducto.storage ?? ''}
                    onChange={(e) => setEditingProducto({ ...editingProducto, storage: e.target.value || null })}
                  />
                )}
              </div>
              <Input label="Color" value={editingProducto.color ?? ''} onChange={(e) => setEditingProducto({ ...editingProducto, color: e.target.value || null })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select label="Condición" options={CONDICION_OPTS} value={editingProducto.condicion} onChange={(e) => setEditingProducto({ ...editingProducto, condicion: e.target.value as any })} />
              <Input label="Batería (%)" type="number" min={0} max={100} value={editingProducto.bateria_salud ?? ''} onChange={(e) => setEditingProducto({ ...editingProducto, bateria_salud: e.target.value ? parseInt(e.target.value) : null })} />
              <Input label="Cantidad" type="number" min={1} value={editingProducto.cantidad} onChange={(e) => setEditingProducto({ ...editingProducto, cantidad: parseInt(e.target.value) || 1 })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Precio compra ($)" type="number" value={editingProducto.precio_compra} onChange={(e) => setEditingProducto({ ...editingProducto, precio_compra: e.target.value })} />
              <Input label="Precio venta ($)" type="number" value={editingProducto.precio_venta} onChange={(e) => setEditingProducto({ ...editingProducto, precio_venta: e.target.value })} />
            </div>
            <Textarea label="Notas" value={editingProducto.notas ?? ''} onChange={(e) => setEditingProducto({ ...editingProducto, notas: e.target.value || null })} />
            <div className="flex gap-3 pt-2">
              <Button variant="primary" onClick={handleSaveEdit} className="flex-1" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </Button>
              <Button variant="secondary" onClick={() => setEditingProducto(null)} className="flex-1">Cancelar</Button>
            </div>
          </div>
        </Modal>
      )}

      {deletingProducto && (
        <Modal isOpen={true} onClose={() => setDeletingProducto(null)} title="¿Eliminar producto?" className="max-w-md">
          <div className="space-y-4">
            <p className="text-gray-700">¿Eliminar <strong>{deletingProducto.nombre}</strong>?</p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800">No es posible eliminar un producto con ventas o compras asociadas.</p>
            </div>
            <div className="flex gap-3">
              <Button variant="danger" onClick={handleDelete} className="flex-1" disabled={saving}>
                {saving ? 'Eliminando...' : 'Sí, eliminar'}
              </Button>
              <Button variant="secondary" onClick={() => setDeletingProducto(null)} className="flex-1">Cancelar</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
