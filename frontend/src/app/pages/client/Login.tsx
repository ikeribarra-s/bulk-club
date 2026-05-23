import { useState } from 'react'
import { useNavigate } from 'react-router'
import { GoogleLogin } from '@react-oauth/google'
import { toast } from 'sonner'
import { Dumbbell } from 'lucide-react'
import { authApi } from '../../api'

export default function ClientLogin() {
  const navigate = useNavigate()
  const [showDni, setShowDni] = useState(false)
  const [form, setForm] = useState({ dni: '', password: '' })
  const [loading, setLoading] = useState(false)

  function redirect(res: { onboarded: boolean; habilitado: boolean }) {
    localStorage.setItem('role', 'client')
    if (!res.onboarded || !res.habilitado) {
      navigate('/onboarding')
    } else {
      navigate('/')
    }
  }

  async function handleGoogleSuccess(credentialResponse: { credential?: string }) {
    if (!credentialResponse.credential) return
    try {
      const res = await authApi.googleLogin(credentialResponse.credential)
      redirect(res)
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  async function handleDniLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!form.dni || !form.password) return
    setLoading(true)
    try {
      const res = await authApi.clientLogin(form.dni, form.password)
      redirect(res)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 text-white">
          <Dumbbell size={48} strokeWidth={1.5} />
          <h1 className="text-3xl font-bold tracking-tight">Bulk Club</h1>
          <p className="text-gray-400 text-sm text-center">Iniciá sesión para acceder a tu cuenta</p>
        </div>

        <div className="w-full flex flex-col items-center gap-4">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => toast.error('Error al iniciar sesión con Google')}
            theme="filled_black"
            shape="pill"
            size="large"
            text="signin_with"
            locale="es"
          />

          <div className="flex items-center gap-3 w-full">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-gray-600">o</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {!showDni ? (
            <button
              onClick={() => setShowDni(true)}
              className="w-full py-2.5 rounded-full border border-white/20 text-sm text-gray-400 hover:text-white hover:border-white/40 transition-colors"
            >
              Ingresar con DNI y contraseña
            </button>
          ) : (
            <form onSubmit={handleDniLogin} className="w-full flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-500">DNI</label>
                <input
                  type="text"
                  value={form.dni}
                  onChange={e => setForm(f => ({ ...f, dni: e.target.value }))}
                  placeholder="Sin puntos ni espacios"
                  autoFocus
                  className="bg-white/10 text-white rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-white/30 placeholder:text-gray-600"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-500">Contraseña</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Tu contraseña"
                  className="bg-white/10 text-white rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-white/30 placeholder:text-gray-600"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !form.dni || !form.password}
                className="mt-1 bg-white text-black font-semibold rounded-lg py-3 text-sm hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                {loading ? 'Ingresando...' : 'Ingresar'}
              </button>
              <button
                type="button"
                onClick={() => setShowDni(false)}
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors text-center"
              >
                Volver
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
