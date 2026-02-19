from datetime import datetime, timedelta, timezone
import hashlib
import os
import secrets
import jwt

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr
from app.emailer import send_reset_email

from app.db import db

SECRET_KEY = os.getenv("AIM2BUILD_SECRET_KEY", "dev-secret-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day

# Password reset settings
RESET_TOKEN_TTL_MINUTES = int(os.getenv("AIM2BUILD_RESET_TTL_MINUTES", "60"))
DEV_RETURN_RESET_TOKEN = os.getenv("AIM2BUILD_DEV_RETURN_RESET_TOKEN", "").strip() in (
    "1",
    "true",
    "TRUE",
    "yes",
    "YES",
)

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


class User(BaseModel):
    id: int
    email: EmailStr


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    # store UTC ISO8601 string
    return dt.astimezone(timezone.utc).isoformat()


def hash_password(password: str) -> str:
    # Simple SHA256 hash for dev; truncate super-long passwords just in case
    raw = password or ""
    if len(raw) > 256:
        raw = raw[:256]
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    return hash_password(password) == password_hash


def _hash_token(token: str) -> str:
    raw = token or ""
    if len(raw) > 1024:
        raw = raw[:1024]
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _ensure_password_reset_table():
    with db() as con:
        con.executescript(
            """
            CREATE TABLE IF NOT EXISTS password_resets (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              token_hash TEXT NOT NULL,
              expires_at TEXT NOT NULL,
              used INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id)
            );
            CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash
            ON password_resets(token_hash);
            """
        )
        con.commit()


_ensure_password_reset_table()


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


async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_raw = payload.get("sub")
        if user_id_raw is None:
            raise credentials_exception
        user_id = int(user_id_raw)
    except Exception:
        raise credentials_exception

    with db() as con:
        cur = con.execute(
            "SELECT id, email FROM users WHERE id = ?",
            (user_id,),
        )
        row = cur.fetchone()

    if not row:
        raise credentials_exception

    return User(id=row["id"], email=row["email"])


@router.post("/register")
def register(payload: RegisterRequest):
    email = payload.email.lower().strip()
    raw_password = payload.password or ""
    if len(raw_password) > 72:
        raw_password = raw_password[:72]
    password_hash = hash_password(raw_password)

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

    if not verify_password(payload.password, password_hash):
        raise HTTPException(status_code=400, detail="Invalid email or password.")

    payload_claims = {
    "sub": str(user_id),
    "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
}
    token = jwt.encode(payload_claims, SECRET_KEY, algorithm=ALGORITHM)

    return TokenResponse(access_token=token, user_id=user_id)


# ----------------------------
# Password reset (minimal v1)
# ----------------------------


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@router.get("/me", response_model=User)
async def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user

@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest):
    """
    Password reset request.
    Always returns 200 to avoid account enumeration.
    """
    email = (req.email or "").lower().strip()

    safe_response = {
        "ok": True,
        "message": "If an account exists for that email, a reset link has been sent.",
    }

    with db() as con:
        cur = con.execute("SELECT id FROM users WHERE email = ?", (email,))
        row = cur.fetchone()
        if not row:
            return safe_response

        user_id = int(row["id"])

        raw_token = secrets.token_urlsafe(32)
        token_hash = _hash_token(raw_token)
        expires_at = _iso(_utcnow() + timedelta(minutes=RESET_TOKEN_TTL_MINUTES))

        con.execute(
            """
            INSERT INTO password_resets (user_id, token_hash, expires_at, used)
            VALUES (?, ?, ?, 0)
            """,
            (user_id, token_hash, expires_at),
        )
        con.commit()

    base = os.getenv("AIM2BUILD_PUBLIC_BASE_URL", "").rstrip("/")
    reset_url = (
        f"{base}/reset-password?token={raw_token}"
        if base
        else f"/reset-password?token={raw_token}"
    )

    try:
        send_reset_email(email, reset_url)
        print(f"[email] password reset sent to {email}")
    except Exception as e:
        print(f"[email] password reset FAILED to {email}: {e}")

    if DEV_RETURN_RESET_TOKEN:
        return {
            **safe_response,
            "reset_token": raw_token,
            "reset_url": reset_url,
            "ttl_minutes": RESET_TOKEN_TTL_MINUTES,
        }

    return safe_response

@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest):
    """
    Consumes a reset token and sets a new password.
    """
    token = (req.token or "").strip()
    new_password = req.new_password or ""

    if not token:
        raise HTTPException(status_code=400, detail="Reset token is required.")

    if len(new_password) < 8:
        raise HTTPException(
            status_code=400, detail="Password must be at least 8 characters."
        )

    if len(new_password) > 72:
        new_password = new_password[:72]

    token_hash = _hash_token(token)
    now_iso = _iso(_utcnow())

    with db() as con:
        # Find valid unused token
        cur = con.execute(
            """
            SELECT id, user_id, expires_at, used
            FROM password_resets
            WHERE token_hash = ? AND used = 0
            """,
            (token_hash,),
        )
        row = cur.fetchone()

        if not row:
            raise HTTPException(
                status_code=400, detail="Reset token is invalid or expired."
            )

        expires_at = row["expires_at"]
        # ISO compare is safe if stored in ISO format (we do)
        if expires_at <= now_iso:
            raise HTTPException(
                status_code=400, detail="Reset token is invalid or expired."
            )

        user_id = int(row["user_id"])
        new_hash = hash_password(new_password)

        # Update password
        con.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (new_hash, user_id),
        )

        # Mark token as used
        con.execute(
            "UPDATE password_resets SET used = 1 WHERE id = ?",
            (int(row["id"]),),
        )

        con.commit()

    return {"ok": True}


class DeleteAccountRequest(BaseModel):
    password: str


def _tables_with_user_id(con) -> list[str]:
    cur = con.execute(
        """
        SELECT m.name
        FROM sqlite_master m
        WHERE m.type='table'
        AND EXISTS (
          SELECT 1
          FROM pragma_table_info(m.name)
          WHERE name='user_id'
        )
        ORDER BY m.name
        """
    )
    return [r[0] for r in cur.fetchall()]


@router.delete("/me")
def delete_current_user(
    payload: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Permanently delete the authenticated user and all associated data.
    Requires password confirmation.
    """
    user_id = int(current_user.id)
    password = (payload.password or "").strip()

    if not password:
        raise HTTPException(status_code=400, detail="Password is required.")

    try:
        with db() as con:
            # Verify password (re-auth)
            row = con.execute(
                "SELECT password_hash FROM users WHERE id = ?",
                (user_id,),
            ).fetchone()

            if not row:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Could not validate credentials",
                )

            if not verify_password(password, row["password_hash"]):
                raise HTTPException(status_code=400, detail="Invalid password.")

            # Delete ALL user-scoped tables (covers poured, discover, meta, etc.)
            for t in _tables_with_user_id(con):
                con.execute(f"DELETE FROM {t} WHERE user_id = ?", (user_id,))

            # Also delete reset tables (in case schema differs across envs)
            try:
                con.execute("DELETE FROM password_resets WHERE user_id = ?", (user_id,))
            except Exception:
                pass
            try:
                con.execute("DELETE FROM password_reset_tokens WHERE user_id = ?", (user_id,))
            except Exception:
                pass

            # Finally delete user
            con.execute("DELETE FROM users WHERE id = ?", (user_id,))
            con.commit()

        return {"ok": True}

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to delete account")
