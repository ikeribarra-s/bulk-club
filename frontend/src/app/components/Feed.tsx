import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Heart,
  MessageCircle,
  Trash2,
  Plus,
  Send,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  X,
  Image as ImageIcon,
  Pencil,
  Check,
  CornerDownRight,
} from 'lucide-react'
import { feedApi, FeedComment, FeedPost, PostCreateBody } from '../api'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'ahora'
  if (m < 60) return `hace ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `hace ${d}d`
  return new Date(dateStr).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function fullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

// ─── RutinaCard ───────────────────────────────────────────────────────────────

function RutinaCard({ rutina }: { rutina: NonNullable<FeedPost['rutina']> }) {
  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-black text-white">
        <Dumbbell size={14} />
        <span className="font-semibold text-sm">{rutina.nombre}</span>
      </div>
      {rutina.descripcion && (
        <p className="px-4 pt-2 text-xs text-gray-500">{rutina.descripcion}</p>
      )}
      {rutina.ejercicios?.length > 0 && (
        <div className="divide-y divide-gray-100">
          {rutina.ejercicios.map((ej: any, i: number) => (
            <div key={i} className="px-4 py-2 flex items-center justify-between text-sm">
              <span className="font-medium text-gray-800">{ej.nombre}</span>
              <span className="text-gray-500 text-xs tabular-nums">
                {[
                  ej.series ? `${ej.series} series` : null,
                  ej.repeticiones ? `× ${ej.repeticiones}` : null,
                  ej.peso_kg ? `${ej.peso_kg} kg` : null,
                ]
                  .filter(Boolean)
                  .join('  ')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── LikersModal ──────────────────────────────────────────────────────────────

function LikersModal({
  likers,
  loading,
  onClose,
}: {
  likers: { cliente_id: string; author_name: string }[]
  loading: boolean
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Heart size={15} className="text-red-500" fill="currentColor" />
            <span className="font-semibold text-sm text-gray-900">Les gustó</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {loading && (
            <p className="text-center text-xs text-gray-400 py-6">Cargando…</p>
          )}
          {!loading && likers.length === 0 && (
            <p className="text-center text-xs text-gray-400 py-6">Nadie ha dado like aún</p>
          )}
          {likers.map((l) => (
            <div key={l.cliente_id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
              <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold shrink-0">
                {initials(l.author_name)}
              </div>
              <span className="text-sm text-gray-800 font-medium">{l.author_name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── PostCard ─────────────────────────────────────────────────────────────────

interface ThreadedComment extends FeedComment {
  replies: FeedComment[]
}

interface PostCardProps {
  post: FeedPost
  currentUserId: string
  isAdmin: boolean
  onLike: (id: string) => void
  onDelete: (id: string) => void
}

function PostCard({ post, currentUserId, isAdmin, onLike, onDelete }: PostCardProps) {
  // Comments
  const [comments, setComments] = useState<FeedComment[]>([])
  const [showComments, setShowComments] = useState(false)
  const [loadingComments, setLoadingComments] = useState(false)

  // New top-level comment
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  // Like
  const [liking, setLiking] = useState(false)
  const [showLikers, setShowLikers] = useState(false)
  const [likers, setLikers] = useState<{ cliente_id: string; author_name: string }[] | null>(null)
  const [loadingLikers, setLoadingLikers] = useState(false)

  // Edit comment
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Reply
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [submittingReply, setSubmittingReply] = useState(false)

  const canDeletePost = isAdmin || post.author_id === currentUserId

  const threaded: ThreadedComment[] = useMemo(() => {
    const top = comments.filter((c) => !c.parent_comment_id)
    const byParent: Record<string, FeedComment[]> = {}
    comments
      .filter((c) => c.parent_comment_id)
      .forEach((c) => {
        const pid = c.parent_comment_id!
        ;(byParent[pid] ??= []).push(c)
      })
    return top.map((c) => ({ ...c, replies: byParent[c.id] ?? [] }))
  }, [comments])

  async function toggleComments() {
    if (!showComments && comments.length === 0) {
      setLoadingComments(true)
      try {
        setComments(await feedApi.getComments(post.id))
      } catch (e: any) {
        toast.error(e.message)
      } finally {
        setLoadingComments(false)
      }
    }
    setShowComments((v) => !v)
  }

  async function handleLike() {
    if (liking || isAdmin) return
    setLiking(true)
    onLike(post.id) // optimistic
    try {
      await feedApi.like(post.id)
      setLikers(null) // invalidate cached likers list
    } catch (e: any) {
      toast.error(e.message)
      onLike(post.id) // revert
    } finally {
      setLiking(false)
    }
  }

  async function openLikers() {
    setShowLikers(true)
    if (likers !== null) return
    setLoadingLikers(true)
    try {
      setLikers(await feedApi.getLikes(post.id))
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoadingLikers(false)
    }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentText.trim() || submittingComment) return
    setSubmittingComment(true)
    try {
      const c = await feedApi.addComment(post.id, commentText.trim())
      setComments((prev) => [...prev, c])
      setCommentText('')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSubmittingComment(false)
    }
  }

  async function submitReply(parentId: string) {
    if (!replyText.trim() || submittingReply) return
    setSubmittingReply(true)
    try {
      const c = await feedApi.addComment(post.id, replyText.trim(), parentId)
      setComments((prev) => [...prev, c])
      setReplyText('')
      setReplyingToId(null)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSubmittingReply(false)
    }
  }

  function startEdit(c: FeedComment) {
    setEditingId(c.id)
    setEditText(c.contenido)
    setReplyingToId(null)
  }

  async function saveEdit(commentId: string) {
    if (!editText.trim() || savingEdit) return
    setSavingEdit(true)
    try {
      const updated = await feedApi.editComment(commentId, editText.trim())
      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)))
      setEditingId(null)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSavingEdit(false)
    }
  }

  async function deleteComment(id: string) {
    try {
      await feedApi.deleteComment(id)
      setComments((prev) => prev.filter((c) => c.id !== id && c.parent_comment_id !== id))
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const inputCls =
    'flex-1 text-xs bg-white border border-gray-200 rounded-full px-3 py-1.5 outline-none focus:border-black transition-colors'

  function renderCommentRow(c: FeedComment, isReply: boolean, replyParentName?: string) {
    const isOwn = c.author_id === currentUserId
    const canEdit = isOwn
    const canDel = isAdmin || isOwn
    const isEditing = editingId === c.id

    return (
      <div key={c.id}>
        <div className={`flex items-start gap-2 px-4 py-2 group ${isReply ? 'pl-10' : ''}`}>
          <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden">
            {initials(c.author_name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-gray-800">{c.author_name}</span>
              {c.author_type === 'admin' && (
                <span className="text-[9px] font-medium bg-black text-white px-1 py-0.5 rounded-full">
                  Admin
                </span>
              )}
              <time
                dateTime={c.created_at}
                title={fullDate(c.created_at)}
                className="text-[10px] text-gray-400 cursor-default"
              >
                {timeAgo(c.created_at)}
              </time>
              {c.edited_at && (
                <span className="text-[10px] text-gray-400 italic">(editado)</span>
              )}
            </div>

            {isReply && replyParentName && (
              <p className="text-[10px] text-gray-400 mb-0.5">↩ {replyParentName}</p>
            )}

            {isEditing ? (
              <div className="flex items-center gap-1 mt-1">
                <input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="flex-1 text-xs border border-gray-300 rounded-lg px-2 py-1 outline-none focus:border-black"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit(c.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                />
                <button
                  onClick={() => saveEdit(c.id)}
                  disabled={savingEdit}
                  className="text-black disabled:opacity-40"
                >
                  <Check size={13} />
                </button>
                <button onClick={() => setEditingId(null)} className="text-gray-400">
                  <X size={13} />
                </button>
              </div>
            ) : (
              <p className="text-xs text-gray-700 mt-0.5 whitespace-pre-wrap">{c.contenido}</p>
            )}

            {/* Action row */}
            {!isEditing && (
              <div className="flex items-center gap-3 mt-1">
                {!isReply && (
                  <button
                    onClick={() => {
                      setReplyingToId(replyingToId === c.id ? null : c.id)
                      setReplyText('')
                      setEditingId(null)
                    }}
                    className="text-[10px] text-gray-400 hover:text-gray-700 flex items-center gap-0.5"
                  >
                    <CornerDownRight size={11} /> Responder
                  </button>
                )}
                {canEdit && (
                  <button
                    onClick={() => startEdit(c)}
                    className="text-[10px] text-gray-400 hover:text-gray-700 flex items-center gap-0.5"
                  >
                    <Pencil size={11} /> Editar
                  </button>
                )}
                {canDel && (
                  <button
                    onClick={() => deleteComment(c.id)}
                    className="text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-0.5"
                  >
                    <Trash2 size={11} /> Eliminar
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Reply input for this comment */}
        {replyingToId === c.id && (
          <div className="pl-10 pr-4 pb-2 flex items-center gap-2">
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={`Responder a ${c.author_name}…`}
              className={inputCls}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitReply(c.id)
                if (e.key === 'Escape') setReplyingToId(null)
              }}
            />
            <button
              onClick={() => submitReply(c.id)}
              disabled={!replyText.trim() || submittingReply}
              className="text-black disabled:text-gray-300"
            >
              <Send size={14} />
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <article className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-1">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
            {post.author_foto_url
              ? <img src={post.author_foto_url} alt={post.author_name} className="w-full h-full object-cover" />
              : initials(post.author_name)
            }
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900 leading-tight">{post.author_name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {post.author_type === 'admin' && (
                <span className="text-[10px] font-medium bg-black text-white px-1.5 py-0.5 rounded-full">
                  Admin
                </span>
              )}
              <time
                dateTime={post.created_at}
                title={fullDate(post.created_at)}
                className="text-[11px] text-gray-400 cursor-default"
              >
                {timeAgo(post.created_at)}
              </time>
            </div>
          </div>
        </div>
        {canDeletePost && (
          <button
            onClick={() => onDelete(post.id)}
            className="text-gray-300 hover:text-red-500 transition-colors p-1"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-2">
        {post.titulo && (
          <p className="font-semibold text-gray-900 mb-1">{post.titulo}</p>
        )}
        {post.contenido && (
          <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{post.contenido}</p>
        )}
        {post.imagen_url && (
          <img
            src={post.imagen_url}
            alt=""
            className="mt-3 w-full rounded-xl object-cover max-h-72"
            loading="lazy"
          />
        )}
        {post.rutina && <RutinaCard rutina={post.rutina} />}
      </div>

      {/* Actions */}
      <div className="px-4 pb-3 pt-1 flex items-center gap-4 border-t border-gray-50 mt-1">
        {!isAdmin && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleLike}
              disabled={liking}
              className={`transition-colors ${
                post.liked_by_me ? 'text-red-500' : 'text-gray-400 hover:text-red-400'
              }`}
            >
              <Heart size={16} fill={post.liked_by_me ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={post.like_count > 0 ? openLikers : undefined}
              className={`text-sm tabular-nums transition-colors ${
                post.like_count > 0
                  ? 'text-gray-600 hover:text-gray-900 cursor-pointer'
                  : 'text-gray-400 cursor-default'
              }`}
            >
              {post.like_count}
            </button>
          </div>
        )}
        <button
          onClick={toggleComments}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          <MessageCircle size={16} />
          <span className="tabular-nums">{post.comment_count}</span>
          {showComments ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="border-t border-gray-100 bg-gray-50/50">
          {loadingComments && (
            <p className="text-center text-xs text-gray-400 py-3">Cargando…</p>
          )}
          {!loadingComments && threaded.length === 0 && (
            <p className="text-center text-xs text-gray-400 py-3">Sin comentarios aún</p>
          )}

          {threaded.map((c) => (
            <div key={c.id}>
              {renderCommentRow(c, false)}
              {c.replies.map((r) =>
                renderCommentRow(r, true, c.author_name),
              )}
            </div>
          ))}

          {/* New top-level comment input */}
          <form
            onSubmit={submitComment}
            className="flex items-center gap-2 px-4 py-2.5 border-t border-gray-100"
          >
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Agregar comentario…"
              className={inputCls}
            />
            <button
              type="submit"
              disabled={!commentText.trim() || submittingComment}
              className="text-black disabled:text-gray-300 transition-colors"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}

      {/* Likers modal */}
      {showLikers && (
        <LikersModal
          likers={likers ?? []}
          loading={loadingLikers}
          onClose={() => setShowLikers(false)}
        />
      )}
    </article>
  )
}

// ─── CreatePostModal ──────────────────────────────────────────────────────────

interface Exercise {
  nombre: string
  series: string
  repeticiones: string
  peso_kg: string
  notas: string
}

const emptyExercise = (): Exercise => ({
  nombre: '',
  series: '',
  repeticiones: '',
  peso_kg: '',
  notas: '',
})

interface CreatePostModalProps {
  onClose: () => void
  onCreated: (post: FeedPost) => void
}

function CreatePostModal({ onClose, onCreated }: CreatePostModalProps) {
  const [tipo, setTipo] = useState<'general' | 'rutina'>('general')
  const [titulo, setTitulo] = useState('')
  const [contenido, setContenido] = useState('')
  const [imagenUrl, setImagenUrl] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [rutinaName, setRutinaName] = useState('')
  const [rutinaDesc, setRutinaDesc] = useState('')
  const [exercises, setExercises] = useState<Exercise[]>([emptyExercise()])
  const [loading, setLoading] = useState(false)

  function updateExercise(i: number, field: keyof Exercise, value: string) {
    setExercises((prev) => prev.map((ex, idx) => (idx === i ? { ...ex, [field]: value } : ex)))
  }

  function addExercise() {
    setExercises((prev) => [...prev, emptyExercise()])
  }

  function removeExercise(i: number) {
    setExercises((prev) => prev.filter((_, idx) => idx !== i))
  }

  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
    setUploadingImage(true)
    try {
      const url = await feedApi.uploadImage(file)
      setImagenUrl(url)
    } catch (err: any) {
      toast.error(err.message)
      setImagePreview(null)
      setImagenUrl('')
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [])

  function clearImage() {
    setImagePreview(null)
    setImagenUrl('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (tipo === 'general' && !contenido.trim() && !imagenUrl.trim()) return
    if (tipo === 'rutina' && !rutinaName.trim()) return

    const body: PostCreateBody = {
      tipo,
      titulo: titulo.trim() || null,
      contenido: contenido.trim() || null,
      imagen_url: imagenUrl.trim() || null,
    }

    if (tipo === 'rutina') {
      body.rutina = {
        nombre: rutinaName.trim(),
        descripcion: rutinaDesc.trim() || null,
        ejercicios: exercises
          .filter((ex) => ex.nombre.trim())
          .map((ex, i) => ({
            nombre: ex.nombre.trim(),
            series: ex.series ? parseInt(ex.series) : null,
            repeticiones: ex.repeticiones.trim() || null,
            peso_kg: ex.peso_kg ? parseFloat(ex.peso_kg) : null,
            notas: ex.notas.trim() || null,
            orden: i,
          })),
      }
    }

    setLoading(true)
    try {
      const post = await feedApi.create(body)
      onCreated(post)
      onClose()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-black transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Nueva publicación</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="flex gap-1 p-4 pb-0">
            {(['general', 'rutina'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  tipo === t ? 'bg-black text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {t === 'general' ? 'Publicación' : 'Rutina'}
              </button>
            ))}
          </div>

          <div className="px-4 py-4 space-y-3">
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título (opcional)"
              className={inputCls}
            />

            {tipo === 'general' && (
              <>
                <textarea
                  value={contenido}
                  onChange={(e) => setContenido(e.target.value)}
                  placeholder="¿Qué querés compartir?"
                  rows={4}
                  className={`${inputCls} resize-none`}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                />
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="preview"
                      className="w-full rounded-xl object-cover max-h-52"
                    />
                    {uploadingImage && (
                      <div className="absolute inset-0 bg-black/30 rounded-xl flex items-center justify-center">
                        <span className="text-white text-xs font-medium">Subiendo…</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={clearImage}
                      className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    <ImageIcon size={14} />
                    Agregar imagen
                  </button>
                )}
              </>
            )}

            {tipo === 'rutina' && (
              <>
                <input
                  value={rutinaName}
                  onChange={(e) => setRutinaName(e.target.value)}
                  placeholder="Nombre de la rutina *"
                  required
                  className={inputCls}
                />
                <input
                  value={rutinaDesc}
                  onChange={(e) => setRutinaDesc(e.target.value)}
                  placeholder="Descripción (opcional)"
                  className={inputCls}
                />
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Ejercicios
                  </p>
                  {exercises.map((ex, i) => (
                    <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          value={ex.nombre}
                          onChange={(e) => updateExercise(i, 'nombre', e.target.value)}
                          placeholder={`Ejercicio ${i + 1} *`}
                          className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-black transition-colors"
                        />
                        {exercises.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeExercise(i)}
                            className="text-gray-300 hover:text-red-400"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { field: 'series' as const, placeholder: 'Series' },
                          { field: 'repeticiones' as const, placeholder: 'Reps' },
                          { field: 'peso_kg' as const, placeholder: 'Peso (kg)' },
                        ].map(({ field, placeholder }) => (
                          <input
                            key={field}
                            value={ex[field]}
                            onChange={(e) => updateExercise(i, field, e.target.value)}
                            placeholder={placeholder}
                            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-black transition-colors"
                          />
                        ))}
                      </div>
                      <input
                        value={ex.notas}
                        onChange={(e) => updateExercise(i, 'notas', e.target.value)}
                        placeholder="Notas (opcional)"
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-black transition-colors"
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addExercise}
                    className="flex items-center gap-1 text-xs text-black font-medium hover:opacity-70"
                  >
                    <Plus size={14} /> Agregar ejercicio
                  </button>
                </div>
              </>
            )}
          </div>
        </form>

        <div className="px-4 py-3 border-t border-gray-100">
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || uploadingImage}
            className="w-full bg-black text-white py-2.5 rounded-xl font-medium text-sm hover:opacity-80 disabled:opacity-40 transition-opacity"
          >
            {loading ? 'Publicando…' : uploadingImage ? 'Subiendo imagen…' : 'Publicar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Feed (main export) ───────────────────────────────────────────────────────

interface FeedProps {
  isAdmin: boolean
  currentUserId: string
}

export default function Feed({ isAdmin, currentUserId }: FeedProps) {
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [skip, setSkip] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const initialLoad = useRef(true)

  useEffect(() => {
    loadPosts(true)
  }, [])

  async function loadPosts(reset = false) {
    const s = reset ? 0 : skip
    setLoading(true)
    try {
      const data = await feedApi.list(s, 20)
      setPosts((prev) => (reset ? data : [...prev, ...data]))
      setSkip(s + data.length)
      setHasMore(data.length === 20)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
      initialLoad.current = false
    }
  }

  function handleLike(postId: string) {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              liked_by_me: !p.liked_by_me,
              like_count: p.liked_by_me ? p.like_count - 1 : p.like_count + 1,
            }
          : p,
      ),
    )
  }

  async function handleDelete(postId: string) {
    if (!confirm('¿Eliminar esta publicación?')) return
    try {
      await feedApi.delete(postId)
      setPosts((prev) => prev.filter((p) => p.id !== postId))
      toast.success('Publicación eliminada')
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  function handleCreated(post: FeedPost) {
    setPosts((prev) => [post, ...prev])
    setSkip((s) => s + 1)
    toast.success('Publicado')
  }

  if (initialLoad.current && loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-gray-200" />
              <div className="space-y-1.5">
                <div className="h-3 w-24 bg-gray-200 rounded" />
                <div className="h-2 w-16 bg-gray-100 rounded" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-100 rounded w-full" />
              <div className="h-3 bg-gray-100 rounded w-4/5" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="relative">
      {posts.length === 0 && !loading ? (
        <div className="text-center py-16 text-gray-400">
          <Dumbbell size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sin publicaciones aún.</p>
          <p className="text-xs mt-1">¡Sé el primero en compartir algo!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onLike={handleLike}
              onDelete={handleDelete}
            />
          ))}
          {hasMore && (
            <button
              onClick={() => loadPosts()}
              disabled={loading}
              className="w-full py-2 text-sm text-gray-400 hover:text-gray-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Cargando…' : 'Ver más'}
            </button>
          )}
        </div>
      )}

      <button
        onClick={() => setShowCreate(true)}
        className="fixed bottom-20 right-4 sm:bottom-8 sm:right-8 w-12 h-12 bg-black text-white rounded-full shadow-lg flex items-center justify-center hover:opacity-80 transition-opacity z-30"
        aria-label="Nueva publicación"
      >
        <Plus size={22} />
      </button>

      {showCreate && (
        <CreatePostModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
    </div>
  )
}
