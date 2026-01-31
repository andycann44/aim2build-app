# backend/app/core/image_resolver.py

from typing import Optional

# This will later point at Cloudflare R2
# e.g. https://img.aim2build.co.uk
IMAGE_BASE_URL = ""

def resolve_image_url(path: Optional[str]) -> Optional[str]:
    """
    Rules:
    - DB is source of truth
    - If path is absolute (http), return as-is
    - If path is relative (/static/...), prepend base URL if configured
    - No disk checks
    - No guessing
    """
    if not path:
        return None

    if path.startswith("http://") or path.startswith("https://"):
        return path

    if IMAGE_BASE_URL:
        return f"{IMAGE_BASE_URL}{path}"

    return path
