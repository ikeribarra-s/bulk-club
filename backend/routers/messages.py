import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth import get_current_client
from backend.database import get_db
from backend.limiter import limiter
from backend.models.cliente import Cliente
from backend.models.message import Message
from backend.models.usuario import Usuario
from backend.schemas.message import MessageCreate, MessageOut, TrainerInfo

router = APIRouter(tags=["Messages"])


def _conversation_filter(client_id: uuid.UUID, trainer_id: uuid.UUID):
    return or_(
        and_(
            Message.sender_id == client_id, Message.sender_type == "client",
            Message.receiver_id == trainer_id, Message.receiver_type == "trainer",
        ),
        and_(
            Message.sender_id == trainer_id, Message.sender_type == "trainer",
            Message.receiver_id == client_id, Message.receiver_type == "client",
        ),
    )


# ─── Client endpoints ─────────────────────────────────────────────────────────

@router.get("/messages")
@limiter.limit("30/minute")  # frontend polls every 5s (12/min)
async def client_get_conversation(
    request: Request,
    cliente: Cliente = Depends(get_current_client),
    db: AsyncSession = Depends(get_db),
):
    if not cliente.trainer_id:
        return {"trainer": None, "messages": [], "unread_count": 0}

    trainer = (await db.execute(
        select(Usuario).where(Usuario.id == cliente.trainer_id)
    )).scalar_one_or_none()
    if not trainer:
        return {"trainer": None, "messages": [], "unread_count": 0}

    messages = (await db.execute(
        select(Message)
        .where(_conversation_filter(cliente.id, cliente.trainer_id))
        .order_by(Message.created_at)
    )).scalars().all()

    unread_count = sum(
        1 for m in messages
        if m.sender_type == "trainer" and m.read_at is None
    )

    return {
        "trainer": TrainerInfo(id=trainer.id, username=trainer.username, foto_url=trainer.foto_url),
        "messages": [MessageOut.model_validate(m) for m in messages],
        "unread_count": unread_count,
    }


@router.post("/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
async def client_send_message(
    request: Request,
    body: MessageCreate,
    cliente: Cliente = Depends(get_current_client),
    db: AsyncSession = Depends(get_db),
):
    if not cliente.trainer_id:
        raise HTTPException(status_code=400, detail="No tenés un entrenador asignado")
    msg = Message(
        sender_id=cliente.id,
        sender_type="client",
        receiver_id=cliente.trainer_id,
        receiver_type="trainer",
        contenido=body.contenido,
        rutina=body.rutina,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


@router.post("/messages/read", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("30/minute")
async def client_mark_read(
    request: Request,
    cliente: Cliente = Depends(get_current_client),
    db: AsyncSession = Depends(get_db),
):
    if not cliente.trainer_id:
        return
    msgs = (await db.execute(
        select(Message).where(
            Message.sender_id == cliente.trainer_id,
            Message.sender_type == "trainer",
            Message.receiver_id == cliente.id,
            Message.receiver_type == "client",
            Message.read_at.is_(None),
        )
    )).scalars().all()
    now = datetime.now(timezone.utc)
    for m in msgs:
        m.read_at = now
    await db.commit()
