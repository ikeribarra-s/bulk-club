import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { CheckCircle, XCircle, Loader, QrCode } from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import { accesoApi } from '../../api'

const MOTIVO_MSG: Record<string, string> = {
  cuota_vencida: 'Cuota vencida',
  ya_ingreso_hoy: 'Ya ingresaste hoy',
  plan_agotado: 'Plan agotado esta semana',
  cuenta_deshabilitada: 'Cuenta deshabilitada',
  sin_membresia: 'Sin membresía asignada',
}

type State = 'scanning' | 'loading' | 'ok' | 'denied'

function clearDiv(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  while (el.firstChild) el.removeChild(el.firstChild)
}

export default function Acceso() {
  const [searchParams] = useSearchParams()
  const autoFire = searchParams.get('qr') === '1'

  const [state, setState] = useState<State>(autoFire ? 'loading' : 'scanning')
  const [message, setMessage] = useState('')
  const [motivo, setMotivo] = useState<string | undefined>()

  const firedRef = useRef(false)

  async function fireCheckin() {
    if (firedRef.current) return
    firedRef.current = true
    setState('loading')
    try {
      const res = await accesoApi.check()
      setMessage(res.message)
      setMotivo(res.motivo)
      setState(res.ok ? 'ok' : 'denied')
    } catch (err: any) {
      setMessage(err.message ?? 'Error al verificar acceso')
      setState('denied')
    }
  }

  // Auto-fire when coming from native camera scan (?qr=1)
  useEffect(() => {
    if (autoFire) fireCheckin()
  }, [])

  // Start QR scanner when in scanning mode
  useEffect(() => {
    if (autoFire) return

    let scanner: Html5Qrcode | null = null
    let started = false
    let stopped = false

    clearDiv('qr-reader')
    scanner = new Html5Qrcode('qr-reader')

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1 },
      (decoded) => {
        if (stopped) return
        try {
          const url = new URL(decoded)
          if (!url.pathname.includes('/acceso')) return
        } catch {
          return
        }
        stopped = true
        scanner?.stop().catch(() => {})
        fireCheckin()
      },
      undefined
    ).then(() => {
      started = true
      // if cleanup already ran before start() resolved, stop now
      if (stopped) scanner?.stop().catch(() => {})
    }).catch(() => {
      setState('denied')
      setMessage('No se pudo acceder a la cámara')
    })

    return () => {
      const alreadyStopped = stopped
      stopped = true
      if (started && !alreadyStopped) {
        scanner?.stop().catch(() => {}).finally(() => {
          try { scanner?.clear() } catch {}
        })
      } else {
        try { scanner?.clear() } catch {}
      }
    }
  }, [autoFire])

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

  if (state === 'denied') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-red-500 text-white text-center p-6">
        <XCircle size={80} strokeWidth={1.5} className="mb-6" />
        <h1 className="text-3xl font-bold mb-2">{motivo ? MOTIVO_MSG[motivo] ?? message : message}</h1>
        <p className="text-red-100 text-lg">{message}</p>
      </div>
    )
  }

  // scanning state
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-6">
      <div className="flex items-center gap-2 mb-6">
        <QrCode size={22} />
        <span className="text-lg font-semibold">Escanear QR</span>
      </div>

      <div className="relative w-72 h-72 rounded-2xl overflow-hidden bg-black">
        <div
          id="qr-reader"
          className="w-full h-full [&>video]:w-full [&>video]:h-full [&>video]:object-cover [&>img]:hidden [&_button]:hidden [&_select]:hidden [&_span]:hidden"
        />
        {/* Corner frame overlay */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 border-white rounded-tl-md" />
          <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 border-white rounded-tr-md" />
          <div className="absolute bottom-3 left-3 w-8 h-8 border-b-2 border-l-2 border-white rounded-bl-md" />
          <div className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 border-white rounded-br-md" />
        </div>
      </div>

      <p className="mt-6 text-gray-400 text-sm text-center">
        Apuntá la cámara al código QR del gimnasio
      </p>
    </div>
  )
}
