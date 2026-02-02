import os

BASE = (os.getenv("AIM2BUILD_IMG_BASE") or "https://img.aim2build.co.uk").strip().rstrip("/")

def _maybe_fix_element_images_path(s: str) -> str:
    """
    Accept both:
      /static/element_images/3003/3003__462.jpg   (nested, canonical)
      /static/element_images/3003__462.jpg        (flat, legacy)
    If flat is given, rewrite to nested using part_num before __
    """
    prefix = "/static/element_images/"
    if not s.startswith(prefix):
        return s

    rest = s[len(prefix):]  # e.g. "3003__462.jpg" OR "3003/3003__462.jpg"
    if "/" in rest:
        return s  # already nested

    # flat -> nested
    fname = rest
    if "__" in fname:
        part_num = fname.split("__", 1)[0]
        return f"{prefix}{part_num}/{fname}"

    return s

def resolve_image_url(u):
    if not u:
        return None

    s = str(u).strip()
    if not s:
        return None

    # already absolute
    if s.startswith("http://") or s.startswith("https://"):
        return s

    # normalize leading slash
    if s.startswith("static/"):
        s = "/" + s
    if s.startswith("set_images/"):
        s = "/" + s

    # fix element_images shape if needed
    s = _maybe_fix_element_images_path(s)

    # rewrite to R2 public domain
    if s.startswith("/static/") or s.startswith("/set_images/"):
        return f"{BASE}{s}"

    return s