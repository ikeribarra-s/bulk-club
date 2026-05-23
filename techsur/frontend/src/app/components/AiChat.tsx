import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Bot, X, Send, Trash2, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

const BASE = import.meta.env.VITE_API_URL ?? '';

// ── Types ──────────────────────────────────────────────────────────────────────

type DisplayMessage = {
  role: 'user' | 'assistant';
  text: string;
  tools?: string[];
  streaming?: boolean;
};

// ── Tool labels ───────────────────────────────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  list_productos: 'Consultando productos',
  get_producto: 'Buscando producto',
  create_producto: 'Creando producto',
  update_producto: 'Actualizando producto',
  delete_producto: 'Eliminando producto',
  list_clientes: 'Consultando clientes',
  get_cliente: 'Buscando cliente',
  create_cliente: 'Creando cliente',
  update_cliente: 'Actualizando cliente',
  delete_cliente: 'Eliminando cliente',
  list_proveedores: 'Consultando proveedores',
  get_proveedor: 'Buscando proveedor',
  create_proveedor: 'Creando proveedor',
  update_proveedor: 'Actualizando proveedor',
  delete_proveedor: 'Eliminando proveedor',
  list_compras: 'Consultando compras',
  create_compra: 'Registrando compra',
  delete_compra: 'Eliminando compra',
  list_ventas: 'Consultando ventas',
  create_venta: 'Registrando venta',
  delete_venta: 'Eliminando venta',
  list_permutas: 'Consultando permutas',
  create_permuta: 'Registrando permuta',
  delete_permuta: 'Eliminando permuta',
};

const SUGGESTIONS = [
  '¿Cuánto stock disponible tengo?',
  '¿Cuál fue la ganancia este mes?',
  'Mostrá los últimos productos cargados',
  '¿Cuáles son mis clientes frecuentes?',
];

// ── Text renderer ─────────────────────────────────────────────────────────────

function renderText(text: string) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const trimmed = line.trimStart();
    const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('• ');
    const isNumbered = /^\d+\.\s/.test(trimmed);
    const raw = isBullet ? trimmed.slice(2) : isNumbered ? trimmed.replace(/^\d+\.\s/, '') : line;

    // Bold: **text**
    const parts = raw.split(/\*\*(.+?)\*\*/g).map((p, j) =>
      j % 2 === 1 ? <strong key={j} className="font-semibold">{p}</strong> : <span key={j}>{p}</span>
    );

    return (
      <span
        key={i}
        className={cn(
          'block leading-relaxed',
          (isBullet || isNumbered) && 'pl-4 relative before:absolute before:left-1',
          isBullet && 'before:content-["·"]',
          isNumbered && `before:content-['${trimmed.match(/^\d+/)?.[0]}']`,
          i > 0 && line === '' ? 'mt-1' : i > 0 ? 'mt-0.5' : ''
        )}
      >
        {parts}
      </span>
    );
  });
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AiChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [display, setDisplay] = useState<DisplayMessage[]>([]);
  const [apiMessages, setApiMessages] = useState<any[]>([]);
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll
  const scrollToBottom = (smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
  };

  useEffect(() => {
    if (open) {
      setTimeout(() => scrollToBottom(false), 50);
    }
  }, [open]);

  useEffect(() => {
    scrollToBottom();
  }, [display, loading]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
  };

  // Grow textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const userMsg: DisplayMessage = { role: 'user', text: msg };
    const newDisplay = [...display, userMsg];
    setDisplay(newDisplay);

    const newApiMessages = [...apiMessages, { role: 'user', content: msg }];
    setLoading(true);
    setActiveTools([]);

    // Add streaming placeholder
    const assistantIndex = newDisplay.length;
    setDisplay([...newDisplay, { role: 'assistant', text: '', streaming: true }]);

    abortRef.current = new AbortController();

    try {
      const res = await fetch(`${BASE}/ai/chat/stream`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newApiMessages }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `Error ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accText = '';
      const toolsUsed: string[] = [];
      let updatedHistory: any[] | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;

          try {
            const event = JSON.parse(data);
            if (event.type === 'tool_call') {
              toolsUsed.push(event.tool);
              setActiveTools([...toolsUsed]);
            } else if (event.type === 'text') {
              accText += event.text;
              setDisplay((prev) => {
                const next = [...prev];
                next[assistantIndex] = {
                  role: 'assistant',
                  text: accText,
                  tools: [...toolsUsed],
                  streaming: true,
                };
                return next;
              });
            } else if (event.type === 'history') {
              updatedHistory = event.messages;
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }

      setDisplay((prev) => {
        const next = [...prev];
        next[assistantIndex] = {
          role: 'assistant',
          text: accText,
          tools: toolsUsed,
          streaming: false,
        };
        return next;
      });
      setActiveTools([]);

      if (updatedHistory) {
        setApiMessages(updatedHistory);
      } else {
        setApiMessages([...newApiMessages, { role: 'assistant', content: accText }]);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      toast.error(err.message ?? 'Error al conectar con el asistente');
      setDisplay((prev) => {
        const next = [...prev];
        next[assistantIndex] = {
          role: 'assistant',
          text: 'Hubo un error al procesar tu mensaje. Intentá de nuevo.',
          streaming: false,
        };
        return next;
      });
    } finally {
      setLoading(false);
      setActiveTools([]);
    }
  };

  const clear = () => {
    abortRef.current?.abort();
    setDisplay([]);
    setApiMessages([]);
    setInput('');
    setActiveTools([]);
    setLoading(false);
  };

  const isEmpty = display.length === 0;

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full',
          'bg-[#2563EB] text-white shadow-lg hover:bg-[#1D4ED8] transition-all',
          'focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2',
          open && 'opacity-0 pointer-events-none'
        )}
      >
        <Bot className="w-5 h-5" />
        <span className="text-sm font-medium">Asistente</span>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Chat panel */}
      <div
        className={cn(
          'fixed z-50 flex flex-col bg-white shadow-2xl transition-transform duration-300 ease-out',
          // Mobile: full screen bottom sheet
          'bottom-0 left-0 right-0 h-[90dvh] rounded-t-2xl',
          // Desktop: side panel
          'md:bottom-0 md:right-0 md:left-auto md:top-0 md:h-screen md:w-[420px] md:rounded-none md:rounded-l-2xl',
          open ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#2563EB]/10">
            <Bot className="w-4 h-4 text-[#2563EB]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Asistente TechSur</p>
            <p className="text-xs text-gray-400">Gestión con IA</p>
          </div>
          <button
            onClick={clear}
            disabled={isEmpty}
            title="Limpiar conversación"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-30"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        >
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[#2563EB]/10">
                <Bot className="w-7 h-7 text-[#2563EB]" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">¿En qué te ayudo hoy?</p>
                <p className="text-xs text-gray-400">Puedo consultar, cargar y modificar datos del negocio</p>
              </div>
              <div className="grid grid-cols-1 gap-2 w-full max-w-xs">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left text-xs px-3 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:border-[#2563EB] hover:text-[#2563EB] hover:bg-[#2563EB]/5 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            display.map((msg, i) => (
              <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'assistant' && (
                  <div className="flex items-end gap-2 max-w-[85%]">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#2563EB]/10 shrink-0 mb-1">
                      <Bot className="w-3.5 h-3.5 text-[#2563EB]" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {/* Tool pills */}
                      {msg.tools && msg.tools.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {msg.tools.map((t) => (
                            <span
                              key={t}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-[#2563EB] text-[10px] font-medium border border-blue-100"
                            >
                              <span className="w-1 h-1 rounded-full bg-[#2563EB]" />
                              {TOOL_LABELS[t] ?? t}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm text-gray-800">
                        {msg.text ? (
                          <div className="space-y-0.5">{renderText(msg.text)}</div>
                        ) : msg.streaming ? (
                          <TypingDots />
                        ) : null}
                        {msg.streaming && msg.text && (
                          <span className="inline-block w-1 h-3.5 ml-0.5 bg-gray-400 animate-pulse rounded-sm align-middle" />
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {msg.role === 'user' && (
                  <div className="max-w-[80%] bg-[#2563EB] text-white rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm">
                    {msg.text}
                  </div>
                )}
              </div>
            ))
          )}

          {/* Loading: tool activity indicator */}
          {loading && activeTools.length > 0 && (
            <div className="flex justify-start">
              <div className="flex items-end gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#2563EB]/10 shrink-0">
                  <Bot className="w-3.5 h-3.5 text-[#2563EB]" />
                </div>
                <div className="flex items-center gap-1.5 bg-gray-100 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] animate-bounce [animation-delay:0ms]" />
                  <span className="text-xs text-gray-500">
                    {TOOL_LABELS[activeTools[activeTools.length - 1]] ?? activeTools[activeTools.length - 1]}...
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Scroll to bottom button */}
        {showScrollBtn && (
          <button
            onClick={() => scrollToBottom()}
            className="absolute bottom-20 right-4 flex items-center justify-center w-8 h-8 rounded-full bg-white border border-gray-200 shadow-md text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        )}

        {/* Input area */}
        <div className="px-4 py-3 border-t border-gray-100 shrink-0 bg-white">
          <div className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2 focus-within:border-[#2563EB] focus-within:ring-1 focus-within:ring-[#2563EB] transition-all">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Escribí tu consulta o instrucción..."
              disabled={loading}
              className="flex-1 bg-transparent resize-none text-[16px] md:text-sm text-gray-800 placeholder-gray-400 focus:outline-none leading-relaxed min-h-[24px] max-h-[120px] disabled:opacity-50"
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 text-center">
            Enter para enviar · Shift+Enter para nueva línea
          </p>
        </div>
      </div>
    </>
  );
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
    </span>
  );
}
