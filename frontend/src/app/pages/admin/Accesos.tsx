import { useEffect, useState, useMemo } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, Search } from 'lucide-react'
import { adminAccesosApi, type Acceso } from '../../api'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const MOTIVO_LABEL: Record<string, string> = {
  cuota_vencida: 'Cuota vencida',
  ya_ingreso_hoy: 'Ya ingresó hoy',
  plan_agotado: 'Plan agotado',
  cuenta_deshabilitada: 'Cuenta deshabilitada',
  sin_membresia: 'Sin membresía',
}

export default function AdminAccesos() {
  const [accesos, setAccesos] = useState<Acceso[]>([])
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(true)

  const [busqueda, setBusqueda] = useState('')
  const [filterResultado, setFilterResultado] = useState<'' | 'permitido' | 'denegado'>('')

  async function load() {
    setLoading(true)
    try { setAccesos(await adminAccesosApi.list({ fecha })) }
    catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [fecha])

  const filtered = useMemo(() => {
    return accesos.filter(a => {
      if (busqueda) {
        const q = busqueda.toLowerCase()
        const name = `${a.cliente_nombre ?? ''} ${a.cliente_apellido ?? ''} ${a.cliente_dni ?? ''}`.toLowerCase()
        if (!name.includes(q)) return false
      }
      if (filterResultado && a.resultado !== filterResultado) return false
      return true
    })
  }, [accesos, busqueda, filterResultado])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Accesos</h1>
        <input
          type="date"
          value={fecha}
          onChange={e => setFecha(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {([['', 'Todos'], ['permitido', 'Permitidos'], ['denegado', 'Denegados']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilterResultado(val)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterResultado === val ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar cliente o DNI..."
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>
      </div>

      {loading ? <p className="text-sm text-gray-400">Cargando...</p> : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Hora</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">DNI</th>
                <th className="px-4 py-3 text-left">Resultado</th>
                <th className="px-4 py-3 text-left">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(a => (
                <tr key={a.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-gray-500 text-xs">{format(parseISO(a.fecha_hora), 'HH:mm:ss', { locale: es })}</td>
                  <td className="px-4 py-3 font-medium">{a.cliente_nombre} {a.cliente_apellido}</td>
                  <td className="px-4 py-3 text-gray-400">{a.cliente_dni ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${a.resultado === 'permitido' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {a.resultado === 'permitido' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                      {a.resultado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{a.motivo ? MOTIVO_LABEL[a.motivo] ?? a.motivo : '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">Sin accesos registrados</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
