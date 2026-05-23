import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Dumbbell, Clock } from 'lucide-react'
import { meApi } from '../../api'

export default function Onboarding() {
  const navigate = useNavigate()
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ nombre: '', apellido: '', dni: '' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre || !form.apellido || !form.dni) {
      toast.error('Completá todos los campos')
      return
    }
    setLoading(true)
    try {
      await meApi.onboarding(form.nombre, form.apellido, form.dni)
      setSubmitted(true)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-white text-center">
        <Clock size={56} strokeWidth={1.5} className="mb-4 text-yellow-400" />
        <h2 className="text-2xl font-bold mb-2">Cuenta pendiente</h2>
        <p className="text-gray-400 max-w-xs">
          Tus datos fueron enviados. El administrador activará tu cuenta en breve.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 text-white mb-8">
          <Dumbbell size={40} strokeWidth={1.5} />
          <h1 className="text-2xl font-bold">Completá tu perfil</h1>
          <p className="text-gray-400 text-sm text-center">
            Necesitamos estos datos para activar tu cuenta
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-400">Nombre</label>
            <input
              type="text"
              value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Tu nombre"
              className="bg-white/10 text-white rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-white/30 placeholder:text-gray-600"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-400">Apellido</label>
            <input
              type="text"
              value={form.apellido}
              onChange={e => setForm(f => ({ ...f, apellido: e.target.value }))}
              placeholder="Tu apellido"
              className="bg-white/10 text-white rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-white/30 placeholder:text-gray-600"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-400">DNI</label>
            <input
              type="text"
              value={form.dni}
              onChange={e => setForm(f => ({ ...f, dni: e.target.value }))}
              placeholder="Sin puntos ni espacios"
              className="bg-white/10 text-white rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-white/30 placeholder:text-gray-600"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-2 bg-white text-black font-semibold rounded-lg py-3 text-sm hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            {loading ? 'Enviando...' : 'Enviar datos'}
          </button>
        </form>
      </div>
    </div>
  )
}
