import { useEffect, useRef, useState } from 'react'
import { CheckCircle, XCircle, Loader } from 'lucide-react'
import { accesoApi } from '../../api'

const MOTIVO_MSG: Record<string, string> = {
  cuota_vencida: 'Cuota vencida',
  ya_ingreso_hoy: 'Ya ingresaste hoy',
  plan_agotado: 'Plan agotado esta semana',
  cuenta_deshabilitada: 'Cuenta deshabilitada',
  sin_membresia: 'Sin membresía asignada',
}

export default function Acceso() {
  const [state, setState] = useState<'loading' | 'ok' | 'denied'>('loading')
  const [message, setMessage] = useState('')
  const [motivo, setMotivo] = useState<string | undefined>()
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true
    accesoApi.check().then(res => {
      setMessage(res.message)
      setMotivo(res.motivo)
      setState(res.ok ? 'ok' : 'denied')
    }).catch(err => {
      setMessage(err.message ?? 'Error al verificar acceso')
      setState('denied')
    })
  }, [])

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader size={40} className="animate-spin text-gray-400" />
        <p className="mt-4 text-gray-500 text-sm">Verificando acceso...</p>
      </div>
    )
  }

  if (state === 'ok') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-green-500 text-white text-center p-6">
        <CheckCircle size={80} strokeWidth={1.5} className="mb-6" />
        <h1 className="text-3xl font-bold mb-2">{message}</h1>
        <p className="text-green-100 text-lg">Podés ingresar</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-red-500 text-white text-center p-6">
      <XCircle size={80} strokeWidth={1.5} className="mb-6" />
      <h1 className="text-3xl font-bold mb-2">{motivo ? MOTIVO_MSG[motivo] ?? message : message}</h1>
      <p className="text-red-100 text-lg">{message}</p>
    </div>
  )
}
