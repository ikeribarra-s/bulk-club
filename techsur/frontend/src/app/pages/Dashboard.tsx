import { useState, useEffect } from "react";
import { toast } from "sonner";
import { api, parseDecimal } from "../api";
import type { Venta, Producto } from "../api";
import { formatCurrency, formatDate } from "../lib/utils";
import StatusBadge from "../components/StatusBadge";

export default function Dashboard() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/ventas/'),
      api.get('/productos/'),
    ])
      .then(([v, p]) => {
        setVentas(v);
        setProductos(p);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevYM = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const ventasMes = ventas.filter((v) => v.fecha_venta.startsWith(currentYM));
  const ventasPrevMes = ventas.filter((v) => v.fecha_venta.startsWith(prevYM));

  // Ingresos split by currency
  const ingresosARS = ventasMes
    .filter((v) => v.moneda === 'ARS')
    .reduce((s, v) => s + parseDecimal(v.precio_final), 0);
  const ingresosUSD = ventasMes
    .filter((v) => v.moneda === 'USD')
    .reduce((s, v) => s + parseDecimal(v.precio_final), 0);

  const ingresosPrevARS = ventasPrevMes
    .filter((v) => v.moneda === 'ARS')
    .reduce((s, v) => s + parseDecimal(v.precio_final), 0);
  const deltaARS = ingresosPrevARS > 0
    ? ((ingresosARS - ingresosPrevARS) / ingresosPrevARS) * 100
    : null;

  // Margen bruto: precio_final (total) - precio_compra * cantidad vendida, ARS only
  const margenMes = ventasMes
    .filter((v) => v.moneda === 'ARS')
    .reduce((sum, v) => {
      const prod = productos.find((p) => p.id === v.producto_id);
      return sum + (parseDecimal(v.precio_final) - parseDecimal(prod?.precio_compra) * v.cantidad);
    }, 0);

  const disponibles = productos.filter((p) => p.cantidad > 0).length;

  const recentVentas = [...ventas]
    .sort((a, b) => new Date(b.fecha_venta).getTime() - new Date(a.fecha_venta).getTime())
    .slice(0, 8);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Ingresos del mes — split ARS / USD */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 col-span-2 md:col-span-1">
          <p className="text-sm text-gray-500 mb-2">Ingresos del mes</p>
          <div className="space-y-1">
            <div>
              <p className="text-xs text-gray-400 leading-none">ARS</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(ingresosARS)}</p>
              {deltaARS !== null && (
                <p className={`text-xs mt-0.5 ${deltaARS >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {deltaARS >= 0 ? '↑' : '↓'} {Math.abs(deltaARS).toFixed(0)}% vs mes anterior
                </p>
              )}
            </div>
            {ingresosUSD > 0 && (
              <div className="pt-1 border-t border-gray-100">
                <p className="text-xs text-gray-400 leading-none">USD</p>
                <p className="text-xl font-bold text-green-700">U$D {ingresosUSD.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <p className="text-sm text-gray-500 mb-1">Ventas del mes</p>
          <p className="text-2xl font-bold text-gray-900">{ventasMes.length}</p>
          <p className={`text-sm mt-1 ${ventasMes.length >= ventasPrevMes.length ? 'text-green-600' : 'text-red-600'}`}>
            {ventasMes.length >= ventasPrevMes.length ? '↑' : '↓'} {Math.abs(ventasMes.length - ventasPrevMes.length)} vs mes anterior
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <p className="text-sm text-gray-500 mb-1">Margen bruto del mes</p>
          <p className={`text-2xl font-bold ${margenMes >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
            {formatCurrency(margenMes)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Solo ventas en ARS</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <p className="text-sm text-gray-500 mb-1">Stock disponible</p>
          <p className="text-2xl font-bold text-green-600">{disponibles}</p>
          <p className="text-xs text-gray-400 mt-1">productos con stock</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Últimas ventas</h2>
        {recentVentas.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-3 font-medium">Producto</th>
                  <th className="pb-3 font-medium">Precio</th>
                  <th className="pb-3 font-medium">Pago</th>
                  <th className="pb-3 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {recentVentas.map((venta) => {
                  const prod = productos.find((p) => p.id === venta.producto_id);
                  return (
                    <tr key={venta.id} className="border-b border-gray-100 last:border-b-0">
                      <td className="py-3 font-medium text-gray-900">
                        {prod ? prod.nombre : `Producto #${venta.producto_id.slice(0, 8)}`}
                      </td>
                      <td className="py-3 text-gray-700">
                        {venta.moneda === 'USD'
                          ? `U$D ${parseDecimal(venta.precio_final).toLocaleString('es-AR')}`
                          : formatCurrency(parseDecimal(venta.precio_final))
                        }
                      </td>
                      <td className="py-3">
                        <StatusBadge status={venta.forma_pago as any} />
                      </td>
                      <td className="py-3 text-gray-500">{formatDate(venta.fecha_venta)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-400 text-sm">No hay ventas registradas aún.</p>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {(['nuevo', 'usado', 'reacondicionado'] as const).map((cond) => {
          const count = productos.filter((p) => p.condicion === cond && p.cantidad > 0).length;
          return (
            <div key={cond} className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center gap-3">
              <StatusBadge status={cond} />
              <span className="text-2xl font-bold text-gray-900">{count}</span>
              <span className="text-sm text-gray-500">en stock</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
