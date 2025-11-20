from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
# from passlib.hash import bcrypt  # no longer needed
import hashlib
import jwt

from app.db import db

SECRET_KEY = "dev-secret-change-me"  # TODO: move to environment
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day

router = APIRouter()

def hash_password(password: str) -> str:
    # Simple SHA256 hash for dev; truncate super-long passwords just in case
    raw = password or ""
    if len(raw) > 256:
        raw = raw[:256]
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    return hash_password(password) == password_hash
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int


@router.post("/register")
def register(payload: RegisterRequest):
    email = payload.email.lower().strip()
    raw_password = payload.password or ""
    if len(raw_password) > 72:
        raw_password = raw_password[:72]
    password_hash = hash_password(payload.password)

    with db() as con:
        cur = con.execute("SELECT id FROM users WHERE email = ?", (email,))
        row = cur.fetchone()
        if row:
            raise HTTPException(status_code=400, detail="User already exists.")

        cur = con.execute(
            "INSERT INTO users (email, password_hash) VALUES (?, ?)",
            (email, password_hash),
        )
        user_id = cur.lastrowid
        con.commit()

    return {"ok": True, "user_id": user_id}


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest):
    email = payload.email.lower().strip()

    with db() as con:
        cur = con.execute(
            "SELECT id, password_hash FROM users WHERE email = ?",
            (email,),
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=400, detail="Invalid email or password.")

    user_id = row["id"]
    password_hash = row["password_hash"]

    if not verify_password(payload.password, row["password_hash"]):
        raise HTTPException(status_code=400, detail="Invalid email or password.")

    payload_claims = {
        "sub": str(user_id),
        "exp": datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    token = jwt.encode(payload_claims, SECRET_KEY, algorithm=ALGORITHM)

    return TokenResponse(access_token=token, user_id=user_id)
