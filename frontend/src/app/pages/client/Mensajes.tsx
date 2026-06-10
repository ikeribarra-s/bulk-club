import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Dumbbell, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { messagesApi, type Message, type TrainerInfo, type Rutina } from '../../api'

function RutinaCard({ rutina }: { rutina: Rutina }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
      >
        <Dumbbell size={14} className="text-black shrink-0" />
        <span className="text-sm font-medium text-gray-900 flex-1 truncate">{rutina.nombre}</span>
        {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-gray-100">
          {rutina.descripcion && (
            <p className="text-xs text-gray-500 pt-2">{rutina.descripcion}</p>
          )}
          {rutina.ejercicios.map((ej, i) => (
            <div key={i} className="flex items-start gap-2 pt-1">
              <span className="text-xs font-semibold text-gray-400 w-4 shrink-0">{i + 1}.</span>
              <div>
                <p className="text-xs font-medium text-gray-800">{ej.nombre}</p>
                <p className="text-xs text-gray-500">
                  {[
                    ej.series != null && `${ej.series} series`,
                    ej.repeticiones && `${ej.repeticiones} reps`,
                    ej.peso_kg != null && `${ej.peso_kg} kg`,
                  ].filter(Boolean).join(' · ')}
                </p>
                {ej.notas && <p className="text-xs text-gray-400 italic">{ej.notas}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MessageBubble({ msg, isMe }: { msg: Message; isMe: boolean }) {
  const time = new Date(msg.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`max-w-[80%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className={`px-3.5 py-2.5 rounded-2xl text-sm ${
            isMe
              ? 'bg-black text-white rounded-br-sm'
              : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm'
          }`}
        >
          {msg.contenido}
          {msg.rutina && <RutinaCard rutina={msg.rutina} />}
        </div>
        <span className="text-[10px] text-gray-400 mt-1 px-1">{time}</span>
      </div>
    </div>
  )
}

export default function Mensajes() {
  const [trainer, setTrainer] = useState<TrainerInfo | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const myIdRef = useRef<string | null>(null)

  const load = useCallback(async (silent = false) => {
    try {
      const data = await messagesApi.getConversation()
      setTrainer(data.trainer)
      setMessages(data.messages)
      if (data.unread_count > 0) messagesApi.markRead().catch(() => {})
    } catch (e: any) {
      if (!silent) toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(() => load(true), 5000)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    setText('')
    try {
      const msg = await messagesApi.send(trimmed)
      setMessages((prev) => [...prev, msg])
    } catch (e: any) {
      toast.error(e.message)
      setText(trimmed)
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Cargando…
      </div>
    )
  }

  if (!trainer) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-6">
        <Dumbbell size={40} className="text-gray-200 mb-3" />
        <p className="text-gray-500 text-sm">Todavía no tenés un entrenador asignado.</p>
        <p className="text-gray-400 text-xs mt-1">Cuando el gimnasio te asigne uno, podrás chatear desde acá.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 mb-3 border-b border-gray-100">
        {trainer.foto_url ? (
          <img src={trainer.foto_url} alt={trainer.username} className="w-9 h-9 rounded-full object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-black flex items-center justify-center text-white text-sm font-bold shrink-0">
            {trainer.username[0].toUpperCase()}
          </div>
        )}
        <div>
          <p className="font-semibold text-sm text-gray-900">{trainer.username}</p>
          <p className="text-xs text-gray-400">Entrenador</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-1 py-2">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">
            Iniciá la conversación con tu entrenador.
          </p>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} isMe={msg.sender_type === 'client'} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="pt-3 border-t border-gray-100 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Escribí un mensaje…"
          className="flex-1 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-black transition-colors"
          disabled={sending}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="bg-black text-white rounded-xl px-3.5 py-2.5 hover:opacity-80 disabled:opacity-30 transition-opacity"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
