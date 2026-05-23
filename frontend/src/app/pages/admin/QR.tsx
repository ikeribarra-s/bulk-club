import { useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Download, Printer, RotateCcw, Info } from 'lucide-react'
import { toast } from 'sonner'

const STORAGE_KEY = 'checkin_qr_url'

function defaultUrl() {
  return `${window.location.origin}/acceso?qr=1`
}

function getSavedUrl() {
  return localStorage.getItem(STORAGE_KEY) || defaultUrl()
}

export default function AdminQR() {
  const [url, setUrl] = useState(getSavedUrl)
  const [draft, setDraft] = useState(getSavedUrl)

  function handleSave() {
    const trimmed = draft.trim()
    if (!trimmed) return
    localStorage.setItem(STORAGE_KEY, trimmed)
    setUrl(trimmed)
    toast.success('URL actualizada')
  }

  function handleReset() {
    const def = defaultUrl()
    setDraft(def)
    setUrl(def)
    localStorage.removeItem(STORAGE_KEY)
    toast.success('URL restablecida')
  }

  function handleDownload() {
    const canvas = document.getElementById('qr-canvas') as HTMLCanvasElement | null
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = 'bulk-club-qr.png'
    a.click()
  }

  function handlePrint() {
    const canvas = document.getElementById('qr-canvas') as HTMLCanvasElement | null
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')

    const win = window.open('', '_blank')
    if (!win) return

    const img = win.document.createElement('img')
    img.src = dataUrl
    img.style.cssText = 'width:320px;height:320px;display:block;margin:0 auto'

    const title = win.document.createElement('p')
    title.textContent = 'Bulk Club — Escanear para ingresar'
    title.style.cssText = 'text-align:center;font-family:sans-serif;font-size:18px;font-weight:600;margin-top:16px'

    const sub = win.document.createElement('small')
    sub.textContent = 'Abrí la app y apuntá al código'
    sub.style.cssText = 'display:block;text-align:center;font-family:sans-serif;color:#666;font-size:13px'

    win.document.body.style.cssText = 'margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh'
    win.document.body.appendChild(img)
    win.document.body.appendChild(title)
    win.document.body.appendChild(sub)

    img.onload = () => { win.print(); win.close() }
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Código QR de acceso</h1>
        <p className="text-sm text-gray-500 mt-1">
          Imprimí este QR y ubicalo en la entrada del gimnasio.
        </p>
      </div>

      {/* QR display */}
      <div className="bg-white rounded-2xl border border-gray-100 p-8 flex flex-col items-center gap-4">
        <QRCodeCanvas
          id="qr-canvas"
          value={url}
          size={260}
          marginSize={2}
          level="M"
        />
        <div className="text-center">
          <p className="font-semibold text-gray-800">Bulk Club — Escanear para ingresar</p>
          <p className="text-xs text-gray-400 mt-0.5 break-all max-w-xs">{url}</p>
        </div>
        <div className="flex gap-3 mt-2">
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 border border-gray-200 rounded-lg px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
          >
            <Download size={15} /> Descargar PNG
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-black text-white rounded-lg px-4 py-2 text-sm hover:bg-gray-800 transition-colors"
          >
            <Printer size={15} /> Imprimir
          </button>
        </div>
      </div>

      {/* Settings */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-gray-800">Configuración</h2>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-500 font-medium">URL que codifica el QR</label>
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 font-mono"
            />
            <button
              onClick={handleSave}
              className="bg-black text-white text-sm rounded-lg px-4 py-2 hover:bg-gray-800 transition-colors"
            >
              Guardar
            </button>
            <button
              onClick={handleReset}
              title="Restablecer al valor por defecto"
              className="border border-gray-200 text-gray-500 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
            >
              <RotateCcw size={15} />
            </button>
          </div>
          <p className="text-xs text-gray-400">
            Por defecto: <code className="bg-gray-100 px-1 rounded">{defaultUrl()}</code>
          </p>
        </div>

        <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
          <Info size={14} className="mt-0.5 shrink-0" />
          <div>
            <strong>¿Cómo funciona?</strong> Los socios escanean el QR con la app desde la
            sección "Ingresar". Si escanean con la cámara del celular directamente, el
            parámetro <code className="bg-blue-100 px-0.5 rounded">?qr=1</code> activa
            el registro automático. Cambiá la URL solo si tu dominio de producción
            es diferente al actual.
          </div>
        </div>
      </div>
    </div>
  )
}
