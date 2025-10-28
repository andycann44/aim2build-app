import os, hashlib, requests
from fastapi import APIRouter, HTTPException, Response

router = APIRouter()
CACHE = "backend/data/img" if os.path.exists("backend") else "data/img"
os.makedirs(CACHE, exist_ok=True)

@router.get("/img")
def proxy(url: str):
    if not (url and url.startswith("http")): raise HTTPException(400, "invalid url")
    key = hashlib.sha256(url.encode()).hexdigest() + ".bin"
    path = os.path.join(CACHE, key)
    if os.path.exists(path):
        return Response(open(path,"rb").read(), media_type="image/jpeg")
    r = requests.get(url, timeout=15)
    if r.status_code != 200: raise HTTPException(502, "upstream failure")
    open(path,"wb").write(r.content)
    return Response(r.content, media_type=r.headers.get("Content-Type","image/jpeg") or "image/jpeg")
