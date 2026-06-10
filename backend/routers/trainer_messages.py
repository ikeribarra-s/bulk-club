import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth import get_current_trainer
from backend.database import get_db
from backend.limiter import limiter
from backend.models.cliente import Cliente
from backend.models.message import Message
from backend.models.usuario import Usuario
from backend.schemas.message import ConversationOut, MessageCreate, MessageOut

router = APIRouter(prefix="/trainer", tags=["Trainer — Messages"])


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


@router.get("/messages", response_model=list[ConversationOut])
@limiter.limit("30/minute")  # frontend polls every 5s (12/min); 2 queries per assigned client
async def list_conversations(
    request: Request,
    trainer: Usuario = Depends(get_current_trainer),
    db: AsyncSession = Depends(get_db),
):
    clientes = (await db.execute(
        select(Cliente).where(Cliente.trainer_id == trainer.id)
    )).scalars().all()

    result = []
    for c in clientes:
        last_msg = (await db.execute(
            select(Message)
            .where(_conversation_filter(c.id, trainer.id))
            .order_by(Message.created_at.desc())
            .limit(1)
        )).scalar_one_or_none()

        unread_count = (await db.execute(
            select(func.count()).where(
                Message.sender_id == c.id,
                Message.sender_type == "client",
                Message.receiver_id == trainer.id,
                Message.receiver_type == "trainer",
                Message.read_at.is_(None),
            )
        )).scalar_one()

        result.append(ConversationOut(
            client_id=c.id,
            client_nombre=c.nombre,
            client_apellido=c.apellido,
            client_foto_url=c.foto_url,
            last_message=last_msg.contenido if last_msg else None,
            last_message_at=last_msg.created_at if last_msg else None,
            unread_count=unread_count,
        ))

    result.sort(
        key=lambda x: x.last_message_at or datetime(2000, 1, 1, tzinfo=timezone.utc),
        reverse=True,
    )
    return result


@router.get("/messages/{client_id}", response_model=list[MessageOut])
@limiter.limit("60/minute")  # polling + switching between client chats
async def get_conversation(
    request: Request,
    client_id: uuid.UUID,
    trainer: Usuario = Depends(get_current_trainer),
    db: AsyncSession = Depends(get_db),
):
    cliente = (await db.execute(
        select(Cliente).where(Cliente.id == client_id)
    )).scalar_one_or_none()
    if not cliente or cliente.trainer_id != trainer.id:
        raise HTTPException(status_code=403, detail="No autorizado")

    messages = (await db.execute(
        select(Message)
        .where(_conversation_filter(client_id, trainer.id))
        .order_by(Message.created_at)
    )).scalars().all()
    return messages


@router.post("/messages/{client_id}", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
async def send_message(
    request: Request,
    client_id: uuid.UUID,
    body: MessageCreate,
    trainer: Usuario = Depends(get_current_trainer),
    db: AsyncSession = Depends(get_db),
):
    cliente = (await db.execute(
        select(Cliente).where(Cliente.id == client_id)
    )).scalar_one_or_none()
    if not cliente or cliente.trainer_id != trainer.id:
        raise HTTPException(status_code=403, detail="No autorizado")

    msg = Message(
        sender_id=trainer.id,
        sender_type="trainer",
        receiver_id=client_id,
        receiver_type="client",
        contenido=body.contenido,
        rutina=body.rutina,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


@router.post("/messages/{client_id}/read", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("60/minute")  # fires on every conversation open
async def mark_read(
    request: Request,
    client_id: uuid.UUID,
    trainer: Usuario = Depends(get_current_trainer),
    db: AsyncSession = Depends(get_db),
):
    cliente = (await db.execute(
        select(Cliente).where(Cliente.id == client_id)
    )).scalar_one_or_none()
    if not cliente or cliente.trainer_id != trainer.id:
        raise HTTPException(status_code=403, detail="No autorizado")

    msgs = (await db.execute(
        select(Message).where(
            Message.sender_id == client_id,
            Message.sender_type == "client",
            Message.receiver_id == trainer.id,
            Message.receiver_type == "trainer",
            Message.read_at.is_(None),
        )
    )).scalars().all()
    now = datetime.now(timezone.utc)
    for m in msgs:
        m.read_at = now
    await db.commit()
