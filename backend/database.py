import ssl as _ssl

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from backend.config import settings


def _async_url(url: str) -> str:
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+asyncpg://" + url[len(prefix):]
    return url


def _connect_args(url: str) -> dict:
    args: dict = {"statement_cache_size": 0}
    if "localhost" not in url and "127.0.0.1" not in url:
        ctx = _ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = _ssl.CERT_NONE
        args["ssl"] = ctx
    return args


_db_url = settings.DATABASE_URL
engine = create_async_engine(
    _async_url(_db_url),
    echo=False,
    connect_args=_connect_args(_db_url),
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
