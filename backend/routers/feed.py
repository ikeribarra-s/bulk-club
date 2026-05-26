import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse
from jose import JWTError, jwt
from sqlalchemy import case, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth import AuthorInfo, get_any_user
from backend.config import settings
from backend.database import get_db
from backend.limiter import limiter
from backend.models.post import Post
from backend.models.post_comment import PostComment
from backend.models.post_like import PostLike
from backend.schemas.feed import (
    CommentCreate,
    CommentEdit,
    CommentOut,
    LikeOut,
    PostCreate,
    PostOut,
)
from backend.utils.uploads import UPLOAD_DIR, delete_upload

_DUMMY_UUID = uuid.UUID("00000000-0000-0000-0000-000000000000")
_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
_MAX_BYTES = 5 * 1024 * 1024  # 5 MB

router = APIRouter(prefix="/feed", tags=["Feed"])


# ─── Per-user rate-limit key ──────────────────────────────────────────────────

def _upload_key(request: Request) -> str:
    """Rate-limit uploads by authenticated user ID, not by IP (avoids shared-NAT collisions)."""
    token = request.cookies.get("token")
    if token:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            if sub := payload.get("sub"):
                return f"upload_user:{sub}"
        except JWTError:
            pass
    return f"upload_ip:{(request.client.host if request.client else 'unknown')}"


# ─── Orphan cleanup ───────────────────────────────────────────────────────────

async def _cleanup_orphans(db: AsyncSession) -> None:
    """Delete local upload files not referenced by any post or client avatar, older than 30 min."""
    from backend.models.cliente import Cliente

    referenced: set[str] = set()

    for url in (await db.execute(select(Post.imagen_url).where(Post.imagen_url.isnot(None)))).scalars():
        if url and "/api/feed/uploads/" in url:
            referenced.add(url.rsplit("/", 1)[-1])

    for url in (await db.execute(select(Cliente.foto_url).where(Cliente.foto_url.isnot(None)))).scalars():
        if url and "/api/feed/uploads/" in url:
            referenced.add(url.rsplit("/", 1)[-1])

    cutoff = time.time() - 1800  # 30-min grace period for in-progress post creation
    for f in UPLOAD_DIR.iterdir():
        if f.is_file() and f.name not in referenced and f.stat().st_mtime < cutoff:
            f.unlink(missing_ok=True)


# ─── File upload ──────────────────────────────────────────────────────────────

@router.post("/upload")
@limiter.limit("10/hour", key_func=_upload_key)
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    _: AuthorInfo = Depends(get_any_user),
    db: AsyncSession = Depends(get_db),
):
    if file.content_type not in _ALLOWED_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tipo de imagen no permitido (jpg, png, webp, gif)")
    data = await file.read()
    if len(data) > _MAX_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La imagen supera los 5 MB")

    await _cleanup_orphans(db)

    ext = (file.filename or "image").rsplit(".", 1)[-1].lower()
    if ext not in {"jpg", "jpeg", "png", "webp", "gif"}:
        ext = "jpg"
    filename = f"{uuid.uuid4()}.{ext}"
    (UPLOAD_DIR / filename).write_bytes(data)
    return {"url": f"/api/feed/uploads/{filename}"}


@router.get("/uploads/{filename}")
async def get_upload(filename: str):
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nombre de archivo inválido")
    path = UPLOAD_DIR / filename
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado")
    return FileResponse(path)


# ─── Posts ────────────────────────────────────────────────────────────────────

def _build_post_out(post: Post, lc: int, cc: int, lm: int) -> PostOut:
    return PostOut(
        id=post.id,
        author_id=post.author_id,
        author_type=post.author_type,
        author_name=post.author_name,
        author_foto_url=post.author_foto_url,
        tipo=post.tipo,
        titulo=post.titulo,
        contenido=post.contenido,
        imagen_url=post.imagen_url,
        rutina=post.rutina,
        like_count=lc,
        comment_count=cc,
        liked_by_me=bool(lm),
        created_at=post.created_at,
    )


@router.get("", response_model=list[PostOut])
@limiter.limit("60/minute")
async def list_posts(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    author_id: uuid.UUID | None = Query(None),
    current_user: AuthorInfo = Depends(get_any_user),
    db: AsyncSession = Depends(get_db),
):
    viewer_id = current_user.id if current_user.role == "client" else _DUMMY_UUID

    lc_sq = select(func.count(PostLike.id)).where(PostLike.post_id == Post.id).correlate(Post).scalar_subquery()
    cc_sq = select(func.count(PostComment.id)).where(PostComment.post_id == Post.id).correlate(Post).scalar_subquery()
    lm_sq = (
        select(func.count(PostLike.id))
        .where(PostLike.post_id == Post.id, PostLike.cliente_id == viewer_id)
        .correlate(Post)
        .scalar_subquery()
    )

    q = (
        select(Post, lc_sq.label("lc"), cc_sq.label("cc"), lm_sq.label("lm"))
        .order_by(case((Post.author_type == "admin", 0), else_=1), desc(Post.created_at))
        .offset(skip)
        .limit(limit)
    )
    if author_id:
        q = q.where(Post.author_id == author_id)

    rows = (await db.execute(q)).all()
    return [_build_post_out(post, lc, cc, lm) for post, lc, cc, lm in rows]


@router.post("/posts", response_model=PostOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def create_post(
    request: Request,
    body: PostCreate,
    current_user: AuthorInfo = Depends(get_any_user),
    db: AsyncSession = Depends(get_db),
):
    post = Post(
        author_id=current_user.id,
        author_type=current_user.role,
        author_name=current_user.display_name,
        author_foto_url=current_user.foto_url,
        tipo=body.tipo,
        titulo=body.titulo,
        contenido=body.contenido,
        imagen_url=body.imagen_url,
        rutina=body.rutina.model_dump() if body.rutina else None,
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return _build_post_out(post, 0, 0, 0)


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
async def delete_post(
    request: Request,
    post_id: uuid.UUID,
    current_user: AuthorInfo = Depends(get_any_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post no encontrado")
    if current_user.role != "admin" and post.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin permiso")
    imagen_url = post.imagen_url
    await db.delete(post)
    await db.commit()
    delete_upload(imagen_url)


# ─── Likes ────────────────────────────────────────────────────────────────────

@router.post("/posts/{post_id}/like")
@limiter.limit("30/minute")
async def toggle_like(
    request: Request,
    post_id: uuid.UUID,
    current_user: AuthorInfo = Depends(get_any_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != "client":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo los clientes pueden dar likes")
    if not (await db.execute(select(Post.id).where(Post.id == post_id))).scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post no encontrado")

    existing = (await db.execute(
        select(PostLike).where(PostLike.post_id == post_id, PostLike.cliente_id == current_user.id)
    )).scalar_one_or_none()

    if existing:
        await db.delete(existing)
        liked = False
    else:
        db.add(PostLike(post_id=post_id, cliente_id=current_user.id))
        liked = True

    await db.commit()
    count = (await db.execute(
        select(func.count(PostLike.id)).where(PostLike.post_id == post_id)
    )).scalar()
    return {"liked": liked, "like_count": count}


@router.get("/posts/{post_id}/likes", response_model=list[LikeOut])
@limiter.limit("30/minute")
async def get_likes(
    request: Request,
    post_id: uuid.UUID,
    _: AuthorInfo = Depends(get_any_user),
    db: AsyncSession = Depends(get_db),
):
    from backend.models.cliente import Cliente
    if not (await db.execute(select(Post.id).where(Post.id == post_id))).scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post no encontrado")
    rows = (await db.execute(
        select(PostLike.cliente_id, Cliente.nombre, Cliente.apellido)
        .join(Cliente, Cliente.id == PostLike.cliente_id)
        .where(PostLike.post_id == post_id)
        .order_by(PostLike.created_at.desc())
    )).all()
    return [
        LikeOut(
            cliente_id=r.cliente_id,
            author_name=" ".join(filter(None, [r.nombre, r.apellido])) or "Cliente",
        )
        for r in rows
    ]


# ─── Comments ─────────────────────────────────────────────────────────────────

@router.get("/posts/{post_id}/comments", response_model=list[CommentOut])
@limiter.limit("60/minute")
async def get_comments(
    request: Request,
    post_id: uuid.UUID,
    _: AuthorInfo = Depends(get_any_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(PostComment)
        .where(PostComment.post_id == post_id)
        .order_by(PostComment.created_at)
    )).scalars().all()
    return rows


@router.post("/posts/{post_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
async def add_comment(
    request: Request,
    post_id: uuid.UUID,
    body: CommentCreate,
    current_user: AuthorInfo = Depends(get_any_user),
    db: AsyncSession = Depends(get_db),
):
    if not (await db.execute(select(Post.id).where(Post.id == post_id))).scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post no encontrado")

    if body.parent_comment_id:
        parent = (await db.execute(
            select(PostComment.id).where(
                PostComment.id == body.parent_comment_id,
                PostComment.post_id == post_id,
            )
        )).scalar_one_or_none()
        if not parent:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comentario padre no encontrado")

    comment = PostComment(
        post_id=post_id,
        parent_comment_id=body.parent_comment_id,
        author_id=current_user.id,
        author_type=current_user.role,
        author_name=current_user.display_name,
        contenido=body.contenido.strip(),
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment


@router.put("/comments/{comment_id}", response_model=CommentOut)
@limiter.limit("20/minute")
async def edit_comment(
    request: Request,
    comment_id: uuid.UUID,
    body: CommentEdit,
    current_user: AuthorInfo = Depends(get_any_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PostComment).where(PostComment.id == comment_id))
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comentario no encontrado")
    if comment.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo podés editar tus propios comentarios")
    comment.contenido = body.contenido.strip()
    comment.edited_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(comment)
    return comment


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
async def delete_comment(
    request: Request,
    comment_id: uuid.UUID,
    current_user: AuthorInfo = Depends(get_any_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PostComment).where(PostComment.id == comment_id))
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comentario no encontrado")
    if current_user.role != "admin" and comment.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin permiso")
    await db.delete(comment)
    await db.commit()
