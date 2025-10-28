import os, hashlib, requests
from fastapi import APIRouter, HTTPException, Response, Query

router = APIRouter()
CACHE = "data/img"; os.makedirs(CACHE, exist_ok=True)

@router.get("/img")
def img(url: str = Query(..., description="Absolute image URL")):
    key = hashlib.sha256(url.encode()).hexdigest()
    path = os.path.join(CACHE, key)
    if os.path.exists(path):
        with open(path, "rb") as f:
            blob = f.read()
        return Response(blob, media_type="image/jpeg")

    try:
        r = requests.get(url, timeout=15)
    except Exception as e:
        raise HTTPException(502, f"fetch failed: {e}")
    if r.status_code != 200:
        raise HTTPException(502, f"upstream {r.status_code}")
    blob = r.content
    with open(path, "wb") as f:
        f.write(blob)
    mt = r.headers.get("Content-Type", "image/jpeg")
    return Response(blob, media_type=mt)
