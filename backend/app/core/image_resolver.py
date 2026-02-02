from __future__ import annotations

import os
from typing import Optional


def resolve_image_url(raw: Optional[str]) -> Optional[str]:
    """
    Convert stored DB img_url values into a URL the frontend can load.

    Rules:
    - If raw is already absolute http(s), return as-is.
    - If raw is a local path like "/static/element_images/...", prefix with AIM2BUILD_IMG_BASE
      (e.g. "https://img.aim2build.co.uk").
    - If AIM2BUILD_IMG_BASE is not set, return the raw path (works for local dev when backend serves /static).
    """
    if raw is None:
        return None

    s = str(raw).strip()
    if not s:
        return None

    if s.startswith("http://") or s.startswith("https://"):
        return s

    if s.startswith("/"):
        base = (os.getenv("AIM2BUILD_IMG_BASE") or "").strip().rstrip("/")
        if base:
            return base + s
        return s

    # anything else: leave it alone
    return s
