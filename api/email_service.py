"""
email_service.py
-------------------------------------------------------------------------
Centralizes every outbound email the app sends: password resets, and the
admin-panel plan-expiry notifications ("your Pro plan expires in 3 days" /
"your Pro plan has expired").

By default (no SMTP env vars set) this just logs the email to the console
so the whole app is fully testable without a mail provider. Set these
environment variables to send real email via SMTP:

    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM

Swap `_send` for your provider's SDK (SendGrid, SES, Postmark, etc.) if you
don't want to use raw SMTP — every call site in this file goes through it.
-------------------------------------------------------------------------
"""

import os
import smtplib
import ssl
from email.message import EmailMessage
from typing import Optional

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM = os.getenv("SMTP_FROM", "no-reply@resumeai.example")
APP_BASE_URL = os.getenv("APP_BASE_URL", "http://127.0.0.1:8000")


def _resolve_smtp_config(db=None) -> dict:
    """Admin-set values (Settings -> Email) win over environment variables,
    which win over the hardcoded defaults above. Passing `db` is optional so
    every existing call site keeps working even before Settings has been
    touched — it just falls back to env vars exactly as before."""
    config = {
        "host": SMTP_HOST, "port": SMTP_PORT, "user": SMTP_USER,
        "password": SMTP_PASSWORD, "from_email": SMTP_FROM,
    }
    if db is not None:
        try:
            from . import settings_service
            admin_config = settings_service.get_smtp_config(db)
            if admin_config.get("smtp_host"):
                config["host"] = admin_config["smtp_host"]
                config["port"] = int(admin_config.get("smtp_port") or 587)
                config["user"] = admin_config.get("smtp_user") or None
                config["password"] = admin_config.get("smtp_password") or None
                config["from_email"] = admin_config.get("smtp_from") or config["from_email"]
        except Exception as exc:
            print(f"[email_service] Could not load admin SMTP settings, using env vars: {exc}")
    return config


def _send(to_email: str, subject: str, body: str, db=None) -> None:
    config = _resolve_smtp_config(db)
    if not config["host"]:
        # No SMTP configured — log instead of sending, so registration/reset/
        # admin flows all still work end-to-end in local development.
        print(f"[email_service] (SMTP not configured — logging instead)\n"
              f"  To: {to_email}\n  Subject: {subject}\n  Body:\n{body}\n")
        return

    msg = EmailMessage()
    msg["From"] = config["from_email"]
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    context = ssl.create_default_context()
    with smtplib.SMTP(config["host"], config["port"]) as server:
        server.starttls(context=context)
        if config["user"] and config["password"]:
            server.login(config["user"], config["password"])
        server.send_message(msg)


def send_password_reset_email(to_email: str, token: str, db=None) -> None:
    link = f"{APP_BASE_URL}/reset-password?token={token}"
    _send(
        to_email,
        "Reset your Resume AI password",
        f"We received a request to reset your Resume AI password.\n\n"
        f"Click the link below to choose a new password (valid for 1 hour):\n{link}\n\n"
        f"If you didn't request this, you can safely ignore this email.",
        db=db,
    )


def send_plan_expiring_soon_email(to_email: str, days_left: int, db=None) -> None:
    _send(
        to_email,
        f"Your Resume AI Pro plan expires in {days_left} day{'s' if days_left != 1 else ''}",
        f"Your Pro subscription is set to expire in {days_left} day"
        f"{'s' if days_left != 1 else ''}. Renew from your account page to keep "
        f"unlimited resumes, cover letters, and AI features.\n\n"
        f"{APP_BASE_URL}/pricing",
        db=db,
    )


def send_plan_expired_email(to_email: str, db=None) -> None:
    _send(
        to_email,
        "Your Resume AI Pro plan has expired",
        f"Your Pro subscription has ended and your account is now on the Free plan "
        f"(1 resume, 1 cover letter). Renew anytime to get unlimited access back.\n\n"
        f"{APP_BASE_URL}/pricing",
        db=db,
    )
