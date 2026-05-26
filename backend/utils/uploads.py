from pathlib import Path

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

_LOCAL_PREFIX = "/api/feed/uploads/"


def delete_upload(url: str | None) -> None:
    """Delete a local upload file given its /api/feed/uploads/{name} URL. No-op for external URLs."""
    if not url or _LOCAL_PREFIX not in url:
        return
    name = url.rsplit("/", 1)[-1]
    if ".." in name or "/" in name or "\\" in name:
        return
    (UPLOAD_DIR / name).unlink(missing_ok=True)


def local_filename(url: str | None) -> str | None:
    """Extract filename from a local upload URL, or None if not local."""
    if not url or _LOCAL_PREFIX not in url:
        return None
    return url.rsplit("/", 1)[-1]
