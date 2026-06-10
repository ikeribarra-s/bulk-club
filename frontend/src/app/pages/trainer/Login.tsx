import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Dumbbell } from 'lucide-react'
import { authApi } from '../../api'

export default function TrainerLogin() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await authApi.adminLogin(username, password)
      if (data.role !== 'trainer') {
        toast.error('Esta cuenta no es de entrenador')
        return
      }
      localStorage.setItem('role', 'trainer')
      navigate('/trainer')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 text-white mb-8">
          <Dumbbell size={40} strokeWidth={1.5} />
          <h1 className="text-2xl font-bold">Bulk Club</h1>
          <p className="text-gray-400 text-sm">Portal de entrenadores</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Usuario"
            className="bg-white/10 text-white rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-white/30 placeholder:text-gray-500"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            className="bg-white/10 text-white rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-white/30 placeholder:text-gray-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-white text-black font-semibold rounded-lg py-3 text-sm hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
