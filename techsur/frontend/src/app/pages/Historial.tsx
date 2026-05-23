import { useEffect, useState, useCallback } from 'react'
import { api } from '../api'
import { RotateCcw, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'

interface HistorialEntry {
  id: string
  tabla: string
  registro_id: string
  operacion: 'CREATE' | 'UPDATE' | 'DELETE'
  antes: Record<string, unknown> | null
  despues: Record<string, unknown> | null
  fuente: string
  resumen: string
  created_at: string
}

const OP_STYLES: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-yellow-100 text-yellow-800',
  DELETE: 'bg-red-100 text-red-800',
}

const FUENTE_STYLES: Record<string, string> = {
  ai: 'bg-purple-100 text-purple-800',
  manual: 'bg-gray-100 text-gray-700',
  restaurar: 'bg-blue-100 text-blue-800',
}

const TABLA_LABELS: Record<string, string> = {
  productos: 'Producto',
  clientes: 'Cliente',
  proveedores: 'Proveedor',
  compras: 'Compra',
  ventas: 'Venta',
  permutas: 'Permuta',
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

function JsonDiff({ antes, despues }: { antes: Record<string, unknown> | null; despues: Record<string, unknown> | null }) {
  const skip = new Set(['id', 'created_at', 'updated_at'])
  const keys = new Set([
    ...Object.keys(antes || {}),
    ...Object.keys(despues || {}),
  ].filter(k => !skip.has(k)))

  const changed = [...keys].filter(k => {
    const a = JSON.stringify((antes || {})[k])
    const b = JSON.stringify((despues || {})[k])
    return a !== b
  })

  if (changed.length === 0 && !antes && despues) {
    return (
      <div className="text-xs text-gray-500 space-y-0.5">
        {[...keys].map(k => (
          <div key={k}><span className="text-gray-400">{k}:</span> <span className="text-green-700">{String((despues || {})[k] ?? '')}</span></div>
        ))}
      </div>
    )
  }

  if (changed.length === 0) return <p className="text-xs text-gray-400">Sin cambios detectados</p>

  return (
    <div className="text-xs space-y-1">
      {changed.map(k => (
        <div key={k} className="grid grid-cols-[120px_1fr_1fr] gap-2 items-start">
          <span className="text-gray-500 truncate">{k}</span>
          {antes && <span className="bg-red-50 text-red-700 px-1 rounded truncate">{String((antes)[k] ?? '—')}</span>}
          {despues && <span className="bg-green-50 text-green-700 px-1 rounded truncate">{String((despues)[k] ?? '—')}</span>}
        </div>
      ))}
    </div>
  )
}

export default function Historial() {
  const [entries, setEntries] = useState<HistorialEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<HistorialEntry | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get('/historial/')
      setEntries(data as HistorialEntry[])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar historial')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleRestore = async (entry: HistorialEntry) => {
    setRestoring(entry.id)
    setConfirm(null)
    setError(null)
    try {
      await api.post(`/historial/${entry.id}/restaurar`, {})
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al restaurar')
    } finally {
      setRestoring(null)
    }
  }

  const canRestore = (e: HistorialEntry) => e.operacion !== 'CREATE'

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Historial de cambios</h1>
          <p className="text-sm text-gray-500">Últimas 200 operaciones. Podés restaurar cualquier UPDATE o DELETE.</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold text-gray-900">Confirmar restauración</h2>
            <p className="text-sm text-gray-600">
              Se va a revertir: <span className="font-medium">{confirm.resumen}</span>
            </p>
            {confirm.operacion === 'DELETE' && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded p-2">
                Se va a re-crear el registro eliminado. Si referencia a otros registros que ya no existen, puede fallar.
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirm(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={() => handleRestore(confirm)}
                disabled={!!restoring}
                className="px-4 py-2 text-sm bg-[#2563EB] text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Restaurar
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && entries.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">Cargando...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No hay cambios registrados todavía.</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3 w-36">Fecha</th>
                <th className="text-left px-4 py-3 w-20">Fuente</th>
                <th className="text-left px-4 py-3 w-24">Operación</th>
                <th className="text-left px-4 py-3 w-24">Entidad</th>
                <th className="text-left px-4 py-3">Resumen</th>
                <th className="px-4 py-3 w-28"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map(entry => (
                <>
                  <tr
                    key={entry.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                  >
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(entry.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${FUENTE_STYLES[entry.fuente] ?? 'bg-gray-100 text-gray-600'}`}>
                        {entry.fuente}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${OP_STYLES[entry.operacion] ?? ''}`}>
                        {entry.operacion}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{TABLA_LABELS[entry.tabla] ?? entry.tabla}</td>
                    <td className="px-4 py-3 text-gray-700">{entry.resumen}</td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {canRestore(entry) && (
                          <button
                            onClick={() => setConfirm(entry)}
                            disabled={restoring === entry.id}
                            title="Restaurar este estado"
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Restaurar
                          </button>
                        )}
                        <button
                          onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400"
                        >
                          {expanded === entry.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expanded === entry.id && (
                    <tr key={`${entry.id}-detail`} className="bg-gray-50">
                      <td colSpan={6} className="px-6 py-4">
                        {entry.operacion === 'UPDATE' && entry.antes && entry.despues ? (
                          <div className="space-y-1">
                            <div className="grid grid-cols-[120px_1fr_1fr] gap-2 text-xs font-medium text-gray-400 mb-1">
                              <span>Campo</span><span>Antes</span><span>Después</span>
                            </div>
                            <JsonDiff antes={entry.antes} despues={entry.despues} />
                          </div>
                        ) : entry.operacion === 'DELETE' && entry.antes ? (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-gray-400 mb-1">Registro eliminado</p>
                            <JsonDiff antes={null} despues={entry.antes} />
                          </div>
                        ) : entry.operacion === 'CREATE' && entry.despues ? (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-gray-400 mb-1">Registro creado</p>
                            <JsonDiff antes={null} despues={entry.despues} />
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400">Sin datos adicionales</p>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
