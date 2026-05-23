import { useState, useEffect } from "react";
import { MessageCircle } from "lucide-react";
import type { Producto } from "../api";
import { parseDecimal } from "../api";
import { formatCurrency } from "../lib/utils";
import Carousel from "../components/Carousel";
import StatusBadge from "../components/StatusBadge";

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER ?? '';

export default function Catalogo() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('todos');

  useEffect(() => {
    fetch(`${BASE}/productos/public`)
      .then((r) => r.json())
      .then(setProductos)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const marcas = [...new Set(productos.map((p) => p.marca))];
  const filtered = filter === 'todos' ? productos : productos.filter((p) => p.marca === filter);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#2563EB]">TechSur</h1>
            <p className="text-xs text-gray-500">Tecnología de calidad</p>
          </div>
          {WHATSAPP_NUMBER && (
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
            >
              <MessageCircle className="w-4 h-4" />
              Consultar
            </a>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-1">Productos disponibles</h2>
          <p className="text-gray-500">{productos.length} producto{productos.length !== 1 ? 's' : ''} en stock</p>
        </div>

        {marcas.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilter('todos')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                filter === 'todos' ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Todos
            </button>
            {marcas.map((m) => (
              <button
                key={m}
                onClick={() => setFilter(m)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  filter === m ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
                <div className="bg-gray-200 h-52" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-16 text-center text-gray-400">
            No hay productos disponibles en este momento.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((producto) => (
              <div key={producto.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <Carousel urls={producto.fotos?.map((f) => f.url) ?? []} height={200} />
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-gray-900 leading-tight">{producto.nombre}</h3>
                    <StatusBadge status={producto.condicion} />
                  </div>
                  <p className="text-sm text-gray-500">
                    {producto.marca} {producto.modelo}
                    {producto.storage ? ` · ${producto.storage}` : ''}
                    {producto.color ? ` · ${producto.color}` : ''}
                  </p>
                  {producto.condicion !== 'nuevo' && producto.bateria_salud != null && (
                    <p className="text-xs text-gray-400">Batería: {producto.bateria_salud}%</p>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-xl font-bold text-[#2563EB]">
                      ${formatCurrency(parseDecimal(producto.precio_venta))}
                    </p>
                    {WHATSAPP_NUMBER && (
                      <a
                        href={`https://wa.me/${WHATSAPP_NUMBER}?text=Hola! Me interesa el ${producto.nombre}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Consultar
                      </a>
                    )}
                  </div>
                  {producto.notas && (
                    <p className="text-xs text-gray-400 italic border-t border-gray-100 pt-2">{producto.notas}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="mt-16 py-8 border-t border-gray-200 text-center text-sm text-gray-400">
        TechSur — Tecnología de calidad
      </footer>
    </div>
  );
}
