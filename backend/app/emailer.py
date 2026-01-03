import json
import os
import smtplib
import ssl
import urllib.request
from email.message import EmailMessage

from app.email_templates import (
    password_reset_subject,
    password_reset_text,
    password_reset_html,
)


def _send_via_resend(to_email: str, reset_url: str) -> None:
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("RESEND_API_KEY missing")

    from_email = os.getenv("AIM2BUILD_EMAIL_FROM", "").strip() or "Aim2Build <no-reply@aim2build.co.uk>"
    # Resend expects either a string or list for "to"; list is safest.
    payload = {
        "from": from_email,
        "to": [to_email],
        "subject": password_reset_subject(),
        "text": password_reset_text(reset_url),
        "html": password_reset_html(reset_url),
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )

    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=20) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            if resp.status < 200 or resp.status >= 300:
                raise RuntimeError(f"Resend error {resp.status}: {body}")
    except Exception as e:
        raise RuntimeError(f"Resend send failed: {e}")


def _send_via_smtp(to_email: str, reset_url: str) -> None:
    host = os.getenv("AIM2BUILD_SMTP_HOST", "").strip()
    port = int((os.getenv("AIM2BUILD_SMTP_PORT", "587") or "587").strip())
    user = os.getenv("AIM2BUILD_SMTP_USER", "").strip()
    pwd = os.getenv("AIM2BUILD_SMTP_PASS", "").strip()
    from_email = os.getenv("AIM2BUILD_EMAIL_FROM", "").strip()

    if not host or not user or not pwd or not from_email:
        raise RuntimeError("SMTP env missing (AIM2BUILD_SMTP_HOST/USER/PASS + AIM2BUILD_EMAIL_FROM)")

    msg = EmailMessage()
    msg["Subject"] = password_reset_subject()
    msg["From"] = from_email
    msg["To"] = to_email
    msg.set_content(password_reset_text(reset_url))
    msg.add_alternative(password_reset_html(reset_url), subtype="html")

    with smtplib.SMTP(host, port, timeout=20) as s:
        s.ehlo()
        s.starttls()
        s.ehlo()
        s.login(user, pwd)
        s.send_message(msg)


def send_reset_email(to_email: str, reset_url: str) -> None:
    """
    Email provider routing:
    - If RESEND_API_KEY is present => Resend (recommended)
    - Else => SMTP (legacy / fallback)
    """
    if os.getenv("RESEND_API_KEY", "").strip():
        _send_via_resend(to_email, reset_url)
        return

    _send_via_smtp(to_email, reset_url)
