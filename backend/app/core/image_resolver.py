import os
from typing import Optional

IMAGE_BASE_URL = os.getenv("AIM2BUILD_IMAGE_BASE_URL", "").rstrip("/")

def resolve_image_url(path: Optional[str]) -> Optional[str]:
    if not path:
        return None
    if path.startswith("http://") or path.startswith("https://"):
        return path
    if path.startswith("/static/") and IMAGE_BASE_URL:
        return f"{IMAGE_BASE_URL}{path}"
    return path