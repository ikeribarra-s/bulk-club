from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, field_validator
from typing import Any
import anthropic
import json

from backend.ai_tools import TOOLS, execute_tool
from backend.auth import verify_token
from backend.config import settings
from backend.database import get_db
from backend.limiter import limiter

router = APIRouter(prefix="/ai", tags=["AI"])

# Single shared client — avoids rebuilding the connection pool on every request.
# Created lazily on first use so a missing API key surfaces as a 503, not a startup crash.
_client: anthropic.AsyncAnthropic | None = None

def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client

SYSTEM_PROMPT = """Sos el asistente de gestión de TechSur, un comercio de electrónica de segunda mano (principalmente smartphones).
Tu rol es ayudar al dueño a gestionar el inventario, ventas, compras, clientes y proveedores usando lenguaje natural.

CAPACIDADES:
- Consultás y analizás todos los datos del negocio (productos, ventas, compras, clientes, proveedores, permutas)
- Creás, modificás y eliminás registros usando las herramientas disponibles
- Ejecutás operaciones en lote: por ejemplo "cargá 5 iPhones usados" o "eliminá todos los productos con margen negativo"
- Calculás métricas: margen bruto, capital inmovilizado, ganancia del mes, etc.

MODELO DE STOCK:
- Cada producto tiene un campo `cantidad` que indica las unidades físicas en stock
- Un producto está "en stock" cuando cantidad > 0; su estado es "disponible"
- Cuando cantidad llega a 0 por una venta, el estado pasa a "vendido" automáticamente
- El estado "reservado" ya no existe — no lo uses nunca
- `precio_final` en ventas es el monto TOTAL de la operación (no el precio por unidad). Para el precio unitario dividí precio_final / cantidad
- Capital inmovilizado = SUM(precio_compra * cantidad) de los productos con cantidad > 0

REGLAS IMPORTANTES:
- Nunca accedas ni menciones la tabla de usuarios
- No muestres precio_compra en tus respuestas a menos que el usuario pida explícitamente datos de costos o márgenes
- Todos los montos están en Pesos Argentinos (ARS) salvo que la venta tenga moneda = "USD"
- Al crear una venta: se descuenta `cantidad` del stock del producto; si llega a 0, el estado pasa a "vendido"
- Al eliminar una venta: el stock del producto se restaura en esa cantidad; si estaba "vendido", vuelve a "disponible"
- Para cargas en lote: primero creá el producto, luego la compra asociada
- Si el precio_venta <= precio_compra, advertí al usuario antes de continuar
- Si el usuario pide eliminar múltiples registros, listalos y ejecutá las eliminaciones una por una

COMPORTAMIENTO:
- Respondé siempre en español
- Sé directo y conciso; usá listas cuando mostrés múltiples registros
- Ante errores de herramientas, explicá qué falló y sugerí cómo continuar
- Si el usuario da información parcial para una operación (ej: falta precio), pedí lo que falta antes de proceder
"""

MAX_ITERATIONS = 15
MAX_HISTORY_MESSAGES = 20  # sliding window: ~10 exchanges

# Haiku for tool-dispatch turns (cheap); Sonnet only for the first/direct-answer turn
MODEL_DISPATCH = "claude-haiku-4-5-20251001"
MODEL_DIRECT = "claude-sonnet-4-6"

# Prompt caching: system prompt and tool list are static — mark for caching so
# subsequent calls in the same 5-min window pay 10% of normal input token price.
_SYSTEM_CACHED = [
    {"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}
]

_TOOLS_CACHED = [
    {**tool, "cache_control": {"type": "ephemeral"}} if i == len(TOOLS) - 1 else tool
    for i, tool in enumerate(TOOLS)
]


class Message(BaseModel):
    role: str
    content: Any


class ChatRequest(BaseModel):
    messages: list[Message]

    @field_validator("messages")
    @classmethod
    def validate_messages(cls, v: list) -> list:
        if len(v) > 100:
            raise ValueError("Historial demasiado largo (máx 100 mensajes)")
        return v


def _trim_history(messages: list[dict]) -> list[dict]:
    """Sliding window: drop old turns beyond MAX_HISTORY_MESSAGES, always starting at a user turn."""
    if len(messages) <= MAX_HISTORY_MESSAGES:
        return messages
    trimmed = messages[-MAX_HISTORY_MESSAGES:]
    for i, msg in enumerate(trimmed):
        if msg.get("role") == "user":
            return trimmed[i:]
    return messages[-1:]


# Fields that are never useful to the model and should be stripped from every tool result.
_ALWAYS_STRIP = frozenset({"updated_at"})
# Additional fields stripped from producto results: estado is always derivable from cantidad > 0.
_PRODUCTO_STRIP = frozenset({"updated_at", "estado"})


def _trim_result(tool_name: str, raw: str) -> str:
    """Strip fields the model never needs from tool results to reduce input tokens."""
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        return raw
    # Don't touch error payloads
    if isinstance(data, dict) and "error" in data:
        return raw
    strip = _PRODUCTO_STRIP if "producto" in tool_name else _ALWAYS_STRIP
    if isinstance(data, list):
        data = [{k: v for k, v in item.items() if k not in strip} for item in data]
    elif isinstance(data, dict):
        data = {k: v for k, v in data.items() if k not in strip}
    return json.dumps(data, ensure_ascii=False)


async def _run_agentic_loop(messages: list[dict], db: AsyncSession) -> list[dict]:
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY no configurada")

    client = _get_client()
    history = _trim_history(list(messages))
    tools_used = False

    for _ in range(MAX_ITERATIONS):
        model = MODEL_DISPATCH if tools_used else MODEL_DIRECT
        max_tokens = 512 if tools_used else 4096

        response = await client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=_SYSTEM_CACHED,
            tools=_TOOLS_CACHED,
            messages=history,
        )

        history.append({"role": "assistant", "content": response.content})

        if response.stop_reason != "tool_use":
            break

        tools_used = True
        tool_results = []
        for block in response.content:
            if block.type != "tool_use":
                continue
            result = await execute_tool(block.name, block.input, db)
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": _trim_result(block.name, result),
            })

        history.append({"role": "user", "content": tool_results})

    return history


def _extract_text(history: list[dict]) -> str:
    for turn in reversed(history):
        if turn.get("role") != "assistant":
            continue
        content = turn.get("content", [])
        if isinstance(content, str):
            return content
        texts = [b.text for b in content if hasattr(b, "text") and b.type == "text"]
        if texts:
            return "\n".join(texts)
    return ""


def _serialize_history(history: list[dict]) -> list[dict]:
    result = []
    for turn in history:
        content = turn["content"]
        if isinstance(content, list):
            blocks = []
            for b in content:
                if hasattr(b, "model_dump"):
                    blocks.append(b.model_dump())
                else:
                    blocks.append(b)
            result.append({"role": turn["role"], "content": blocks})
        else:
            result.append({"role": turn["role"], "content": content})
    return result


@router.post("/chat")
@limiter.limit("20/minute")
async def chat(
    request: Request,
    req: ChatRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_token),
):
    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    history = await _run_agentic_loop(messages, db)
    reply = _extract_text(history)
    serialized = _serialize_history(history)
    return {"reply": reply, "messages": serialized}


@router.post("/chat/stream")
@limiter.limit("20/minute")
async def chat_stream(
    request: Request,
    req: ChatRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(verify_token),
):
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY no configurada")

    messages = [{"role": m.role, "content": m.content} for m in req.messages]

    async def event_stream():
        client = _get_client()
        history = _trim_history(list(messages))
        tools_used = False

        for _ in range(MAX_ITERATIONS):
            model = MODEL_DISPATCH if tools_used else MODEL_DIRECT
            max_tokens = 512 if tools_used else 4096

            response = await client.messages.create(
                model=model,
                max_tokens=max_tokens,
                system=_SYSTEM_CACHED,
                tools=_TOOLS_CACHED,
                messages=history,
            )

            history.append({"role": "assistant", "content": response.content})

            if response.stop_reason != "tool_use":
                for block in response.content:
                    if hasattr(block, "text"):
                        chunk = json.dumps({"type": "text", "text": block.text}, ensure_ascii=False)
                        yield f"data: {chunk}\n\n"
                serialized = _serialize_history(history)
                yield f"data: {json.dumps({'type': 'history', 'messages': serialized}, ensure_ascii=False)}\n\n"
                yield "data: [DONE]\n\n"
                return

            tools_used = True
            tool_results = []
            for block in response.content:
                if block.type != "tool_use":
                    continue
                yield f"data: {json.dumps({'type': 'tool_call', 'tool': block.name}, ensure_ascii=False)}\n\n"
                result = await execute_tool(block.name, block.input, db)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": _trim_result(block.name, result),
                })

            history.append({"role": "user", "content": tool_results})

        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
