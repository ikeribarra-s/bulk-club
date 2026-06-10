import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Dumbbell, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { trainerMessagesApi, type Message, type Conversation, type Rutina } from '../../api'

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
          {rutina.descripcion && <p className="text-xs text-gray-500 pt-2">{rutina.descripcion}</p>}
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

function MessageBubble({ msg, isTrainer }: { msg: Message; isTrainer: boolean }) {
  const time = new Date(msg.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  return (
    <div className={`flex ${isTrainer ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`max-w-[75%] flex flex-col ${isTrainer ? 'items-end' : 'items-start'}`}>
        <div className={`px-3.5 py-2.5 rounded-2xl text-sm ${isTrainer ? 'bg-black text-white rounded-br-sm' : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm'}`}>
          {msg.contenido}
          {msg.rutina && <RutinaCard rutina={msg.rutina} />}
        </div>
        <span className="text-[10px] text-gray-400 mt-1 px-1">{time}</span>
      </div>
    </div>
  )
}

type DraftEj = { nombre: string; series: string; repeticiones: string; peso_kg: string; notas: string }

function RutinaComposer({ value, onChange }: { value: Rutina | null; onChange: (r: Rutina | null) => void }) {
  const empty: DraftEj = { nombre: '', series: '', repeticiones: '', peso_kg: '', notas: '' }
  const [nombre, setNombre] = useState(value?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(value?.descripcion ?? '')
  const [ejercicios, setEjercicios] = useState<DraftEj[]>([empty])

  function build() {
    if (!nombre.trim()) return null
    return {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      ejercicios: ejercicios.filter((e) => e.nombre.trim()).map((e, i) => ({
        nombre: e.nombre.trim(),
        series: e.series ? parseInt(e.series) : null,
        repeticiones: e.repeticiones.trim() || null,
        peso_kg: e.peso_kg ? parseFloat(e.peso_kg) : null,
        notas: e.notas.trim() || null,
        orden: i,
      })),
    }
  }

  useEffect(() => { onChange(build()) }, [nombre, descripcion, ejercicios])

  function updateEj(i: number, field: keyof DraftEj, v: string) {
    setEjercicios((prev) => prev.map((e, idx) => idx === i ? { ...e, [field]: v } : e))
  }

  return (
    <div className="border border-gray-200 rounded-xl p-3 space-y-3 bg-gray-50">
      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Rutina adjunta</p>
      <div className="space-y-2">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la rutina *" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-black" />
        <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción (opcional)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-black" />
      </div>
      <div className="space-y-2">
        {ejercicios.map((ej, i) => (
          <div key={i} className="flex gap-1.5 items-start">
            <div className="flex-1 grid grid-cols-2 gap-1.5">
              <input value={ej.nombre} onChange={(e) => updateEj(i, 'nombre', e.target.value)} placeholder={`Ejercicio ${i + 1}`} className="col-span-2 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white outline-none focus:border-black" />
              <input value={ej.series} onChange={(e) => updateEj(i, 'series', e.target.value)} placeholder="Series" type="number" className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white outline-none focus:border-black" />
              <input value={ej.repeticiones} onChange={(e) => updateEj(i, 'repeticiones', e.target.value)} placeholder="Reps" className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white outline-none focus:border-black" />
              <input value={ej.peso_kg} onChange={(e) => updateEj(i, 'peso_kg', e.target.value)} placeholder="Peso (kg)" type="number" className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white outline-none focus:border-black" />
              <input value={ej.notas} onChange={(e) => updateEj(i, 'notas', e.target.value)} placeholder="Notas" className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white outline-none focus:border-black" />
            </div>
            <button onClick={() => setEjercicios((prev) => prev.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-400 transition-colors mt-1.5"><Trash2 size={14} /></button>
          </div>
        ))}
        <button onClick={() => setEjercicios((prev) => [...prev, { ...empty }])} className="flex items-center gap-1 text-xs text-gray-500 hover:text-black transition-colors">
          <Plus size={13} /> Agregar ejercicio
        </button>
      </div>
    </div>
  )
}

export default function TrainerMensajes() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [showRutina, setShowRutina] = useState(false)
  const [rutinaDraft, setRutinaDraft] = useState<Rutina | null>(null)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadConversations = useCallback(async (silent = false) => {
    try { setConversations(await trainerMessagesApi.listConversations()) }
    catch (e: any) { if (!silent) toast.error(e.message) }
  }, [])

  const loadMessages = useCallback(async (clientId: string, silent = false) => {
    try {
      setMessages(await trainerMessagesApi.getConversation(clientId))
      trainerMessagesApi.markRead(clientId).catch(() => {})
    } catch (e: any) { if (!silent) toast.error(e.message) }
  }, [])

  useEffect(() => {
    loadConversations()
    const i = setInterval(() => loadConversations(true), 5000)
    return () => clearInterval(i)
  }, [loadConversations])

  useEffect(() => {
    if (!activeId) return
    loadMessages(activeId)
    const i = setInterval(() => loadMessages(activeId, true), 5000)
    return () => clearInterval(i)
  }, [activeId, loadMessages])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  async function handleSend() {
    if (!activeId || (!text.trim() && !rutinaDraft)) return
    if (rutinaDraft && !rutinaDraft.nombre?.trim()) { toast.error('La rutina necesita un nombre'); return }
    setSending(true)
    const body = text.trim() || `Rutina: ${rutinaDraft!.nombre}`
    try {
      const msg = await trainerMessagesApi.send(activeId, body, rutinaDraft)
      setMessages((prev) => [...prev, msg])
      setText(''); setRutinaDraft(null); setShowRutina(false)
      loadConversations(true)
    } catch (e: any) { toast.error(e.message) }
    finally { setSending(false) }
  }

  const active = conversations.find((c) => c.client_id === activeId)

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 overflow-hidden rounded-2xl border border-gray-200 bg-white">
      {/* Sidebar */}
      <div className="w-72 shrink-0 border-r border-gray-100 flex flex-col">
        <div className="px-4 py-4 border-b border-gray-100">
          <h1 className="font-semibold text-gray-900">Mis clientes</h1>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {conversations.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8 px-4">No tenés clientes asignados aún.</p>
          )}
          {conversations.map((conv) => {
            const name = [conv.client_nombre, conv.client_apellido].filter(Boolean).join(' ') || 'Sin nombre'
            return (
              <button
                key={conv.client_id}
                onClick={() => setActiveId(conv.client_id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${activeId === conv.client_id ? 'bg-gray-50' : ''}`}
              >
                {conv.client_foto_url
                  ? <img src={conv.client_foto_url} className="w-9 h-9 rounded-full object-cover shrink-0" alt={name} />
                  : <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-semibold shrink-0">{name[0]?.toUpperCase()}</div>
                }
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                  {conv.last_message && <p className="text-xs text-gray-400 truncate">{conv.last_message}</p>}
                </div>
                {conv.unread_count > 0 && (
                  <span className="shrink-0 w-5 h-5 rounded-full bg-black text-white text-[10px] flex items-center justify-center font-semibold">
                    {conv.unread_count > 9 ? '9+' : conv.unread_count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!activeId ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Seleccioná un cliente</div>
        ) : (
          <>
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2.5">
              {active && (
                <>
                  {active.client_foto_url
                    ? <img src={active.client_foto_url} className="w-8 h-8 rounded-full object-cover" alt="" />
                    : <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600">{([active.client_nombre, active.client_apellido].filter(Boolean).join(' ') || '?')[0].toUpperCase()}</div>
                  }
                  <span className="font-medium text-gray-900 text-sm">
                    {[active.client_nombre, active.client_apellido].filter(Boolean).join(' ') || 'Sin nombre'}
                  </span>
                </>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {messages.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-8">Enviá el primer mensaje.</p>
              )}
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} isTrainer={msg.sender_type === 'trainer'} />
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="px-5 py-3 border-t border-gray-100 space-y-2">
              {showRutina && <RutinaComposer value={rutinaDraft} onChange={setRutinaDraft} />}
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowRutina((v) => !v); if (showRutina) setRutinaDraft(null) }}
                  className={`p-2.5 rounded-xl border transition-colors ${showRutina ? 'border-black bg-black text-white' : 'border-gray-200 text-gray-400 hover:border-gray-400'}`}
                  title="Adjuntar rutina"
                >
                  <Dumbbell size={16} />
                </button>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                  placeholder={showRutina ? 'Mensaje opcional…' : 'Escribí un mensaje…'}
                  className="flex-1 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-black transition-colors"
                  disabled={sending}
                />
                <button
                  onClick={handleSend}
                  disabled={(!text.trim() && !rutinaDraft) || sending}
                  className="bg-black text-white rounded-xl px-3.5 py-2.5 hover:opacity-80 disabled:opacity-30 transition-opacity"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
