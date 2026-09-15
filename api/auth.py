"""
auth.py
-------------------------------------------------------------------------
Password hashing (bcrypt), JWT issuing/verification, RBAC permission
system, rate limiting, and password strength validation.
-------------------------------------------------------------------------
"""

import os
import re
import secrets
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import bcrypt
from sqlalchemy.orm import Session

from .database import get_db
from . import models

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 4  # 4 hours (SEC-AUTH-004)
RESET_TOKEN_EXPIRE_MINUTES = 60

# Rate limiting (SEC-NET-004): max failed logins before lockout
MAX_FAILED_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15
# In-memory rate limiter for IP-based limiting
_login_attempts: dict = defaultdict(list)
MAX_LOGIN_ATTEMPTS_PER_IP = 20
LOGIN_WINDOW_SECONDS = 300

MIN_PASSWORD_LENGTH = 14  # SEC-AUTH-006

# RBAC permission matrix (SEC-AUTHZ-002)
PERMISSION_MATRIX = {
    "super_admin": {
        "users.read", "users.write", "users.delete",
        "resumes.read", "resumes.delete",
        "templates.read", "templates.write",
        "settings.read", "settings.write",
        "audit_log.read",
        "ip_allowlist.read", "ip_allowlist.write",
        "roles.write",
        "config_history.read", "config_history.revert",
    },
    "content_manager": {
        "users.read",
        "resumes.read", "resumes.delete",
        "templates.read", "templates.write",
        "settings.read", "settings.write",
        "audit_log.read",
        "config_history.read",
    },
    "moderator": {
        "users.read",
        "resumes.read", "resumes.delete",
        "templates.read",
        "audit_log.read",
    },
    "viewer": {
        "users.read",
        "resumes.read",
        "templates.read",
        "audit_log.read",
    },
}

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def generate_reset_token() -> str:
    return secrets.token_urlsafe(32)


def validate_password_strength(password: str) -> Optional[str]:
    if len(password) < MIN_PASSWORD_LENGTH:
        return f"Password must be at least {MIN_PASSWORD_LENGTH} characters long"
    if not re.search(r"[A-Z]", password):
        return "Password must contain at least one uppercase letter"
    if not re.search(r"[a-z]", password):
        return "Password must contain at least one lowercase letter"
    if not re.search(r"\d", password):
        return "Password must contain at least one digit"
    if not re.search(r"[^A-Za-z0-9]", password):
        return "Password must contain at least one special character"
    return None


def check_ip_rate_limit(ip: str) -> bool:
    now = datetime.utcnow()
    cutoff = now - timedelta(seconds=LOGIN_WINDOW_SECONDS)
    _login_attempts[ip] = [t for t in _login_attempts[ip] if t > cutoff]
    if len(_login_attempts[ip]) >= MAX_LOGIN_ATTEMPTS_PER_IP:
        return False
    _login_attempts[ip].append(now)
    return True


def check_account_lockout(user: models.User) -> Optional[str]:
    if user.locked_until and user.locked_until > datetime.utcnow():
        remaining = int((user.locked_until - datetime.utcnow()).total_seconds() / 60) + 1
        return f"Account locked due to too many failed attempts. Try again in {remaining} minute(s)."
    return None


def record_failed_login(user: models.User, db: Session):
    user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
    if user.failed_login_attempts >= MAX_FAILED_LOGIN_ATTEMPTS:
        user.locked_until = datetime.utcnow() + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
    db.commit()


def record_successful_login(user: models.User, ip: str, db: Session):
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = datetime.utcnow()
    user.last_login_ip = ip
    db.commit()


def enforce_plan_expiry(user: models.User, db: Session) -> models.User:
    if user.plan != "free" and user.plan_expires_at and user.plan_expires_at < datetime.utcnow():
        user.plan = "free"
        user.plan_expires_at = None
        user.plan_started_at = None
        db.commit()
        db.refresh(user)
    return user


def hash_password(password: str) -> str:
    pw = password.encode("utf-8")[:72]
    return bcrypt.hashpw(pw, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8")[:72], hashed.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: str, token_version: int = 0) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "tv": token_version, "exp": expire, "iat": datetime.utcnow()}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


def has_permission(role: str, permission: str) -> bool:
    return permission in PERMISSION_MATRIX.get(role, set())


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    payload = decode_token(token)
    if not payload or not payload.get("sub"):
        raise credentials_exception
    user_id = payload["sub"]
    token_version = payload.get("tv", 0)
    user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.is_deleted == False,
    ).first()
    if not user:
        raise credentials_exception
    if (user.token_version or 0) != (token_version or 0):
        raise credentials_exception
    return enforce_plan_expiry(user, db)


def get_current_admin(
    request: Request,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> models.User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )

    # Enforce IP allowlist if entries exist (SEC-AUTHZ-004)
    allowlist = db.query(models.AdminIpAllowlist).all()
    if allowlist:
        client_ip = get_client_ip(request)
        allowed_ips = {entry.ip_address for entry in allowlist}
        # In local dev/testing allow loopback
        if client_ip not in allowed_ips and client_ip not in ("127.0.0.1", "::1", "localhost", "testclient"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access restricted by IP allowlist"
            )

    return current_user


def require_permission(permission: str):
    def checker(current_user: models.User = Depends(get_current_admin)) -> models.User:
        if not has_permission(current_user.role, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions: '{permission}' required"
            )
        return current_user
    return checker


def get_current_user_optional(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> Optional[models.User]:
    if not token:
        return None
    payload = decode_token(token)
    if not payload or not payload.get("sub"):
        return None
    user = db.query(models.User).filter(
        models.User.id == payload["sub"],
        models.User.is_deleted == False,
    ).first()
    if not user:
        return None
    if (user.token_version or 0) != payload.get("tv", 0):
        return None
    return user


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
