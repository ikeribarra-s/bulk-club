from fastapi import Request
from jose import JWTError, jwt
from slowapi import Limiter
from slowapi.util import get_remote_address

from backend.config import settings


def user_or_ip_key(request: Request) -> str:
    """Rate-limit key: the authenticated user's ID (JWT `sub`) when available,
    client IP otherwise. Gym clients share the gym Wi-Fi (one NAT'd public IP),
    so keying by IP alone would put all of them in the same bucket."""
    token = request.cookies.get("token")
    if token:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            if sub := payload.get("sub"):
                return f"user:{sub}"
        except JWTError:
            pass
    return f"ip:{get_remote_address(request)}"


# default_limits is a generous safety net applied (via SlowAPIMiddleware in
# main.py) to every endpoint that has no explicit @limiter.limit decorator.
limiter = Limiter(key_func=user_or_ip_key, default_limits=["300/minute"], headers_enabled=True)
