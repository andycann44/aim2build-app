import os
import smtplib
from email.message import EmailMessage

from app.email_templates import (
    password_reset_subject,
    password_reset_text,
    password_reset_html,
)


def send_reset_email(to_email: str, reset_url: str) -> None:
    host = os.getenv("AIM2BUILD_SMTP_HOST", "").strip()
    port = int((os.getenv("AIM2BUILD_SMTP_PORT", "587") or "587").strip())
    user = os.getenv("AIM2BUILD_SMTP_USER", "").strip()
    pwd = os.getenv("AIM2BUILD_SMTP_PASS", "").strip()
    from_email = (os.getenv("AIM2BUILD_EMAIL_FROM", "") or "support@aim2build.co.uk").strip()

    if not host or not user or not pwd:
        raise RuntimeError("SMTP not configured (missing AIM2BUILD_SMTP_HOST/USER/PASS)")

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
