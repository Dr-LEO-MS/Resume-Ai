"""
models.py
-------------------------------------------------------------------------
SQLAlchemy ORM models (SQLAlchemy 2.0 typed style — `Mapped[...]` gives
Pylance/mypy real attribute types instead of Column[...]). Tables:
  - User: authentication + profile
  - Resume: one row per saved resume, content stored as JSON so the schema
    can evolve (new sections, new fields) without a migration every time.
  - SiteSetting: admin-editable whole-site configuration groups.
  - AuditLogEntry: admin action trail.
  - AiUsageLog: per-user AI action log (server-side free-tier limits).
-------------------------------------------------------------------------
"""

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

ADMIN_ROLES = ("super_admin", "content_manager", "moderator", "viewer")
ALL_ROLES = ("user",) + ADMIN_ROLES


def gen_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    google_id: Mapped[Optional[str]] = mapped_column(String, unique=True, index=True, nullable=True)
    full_name: Mapped[str] = mapped_column(String, default="")
    plan: Mapped[str] = mapped_column(String, default="free")  # free | pro | teams
    role: Mapped[str] = mapped_column(String, default="user")  # user | super_admin | content_manager | moderator | viewer
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # ---- Time-limited Pro subscriptions --------------------------------
    plan_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    plan_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    expiry_notified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # ---- Password reset --------------------------------------------------
    reset_token: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    reset_token_expires: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # ---- Soft-delete (ADMIN-DEL-001) ------------------------------------
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    deleted_by: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # ---- Failed login tracking (SEC-NET-004) ----------------------------
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_login_ip: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # ---- Profile & preferences (ACCT-MGMT) --------------------------------
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    profile_picture_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    profile_slug: Mapped[Optional[str]] = mapped_column(String, unique=True, nullable=True)
    is_profile_public: Mapped[bool] = mapped_column(Boolean, default=False)
    timezone: Mapped[str] = mapped_column(String, default="UTC")
    date_format: Mapped[str] = mapped_column(String, default="MM/DD/YYYY")
    locale: Mapped[str] = mapped_column(String, default="en")
    notifications_email: Mapped[bool] = mapped_column(Boolean, default=True)
    notifications_product: Mapped[bool] = mapped_column(Boolean, default=True)
    has_set_password: Mapped[bool] = mapped_column(Boolean, default=False)
    token_version: Mapped[int] = mapped_column(Integer, default=0)

    resumes = relationship("Resume", back_populates="owner", cascade="all, delete-orphan")

    @property
    def is_admin(self) -> bool:
        return self.role in ADMIN_ROLES

    @property
    def has_google(self) -> bool:
        return bool(self.google_id)


class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    owner_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    name: Mapped[str] = mapped_column(String, default="Untitled resume")
    template: Mapped[str] = mapped_column(String, default="classic")
    doc_type: Mapped[str] = mapped_column(String, default="resume")
    content: Mapped[Any] = mapped_column(JSON, nullable=False)
    is_public: Mapped[bool] = mapped_column(default=False)
    share_slug: Mapped[Optional[str]] = mapped_column(String, unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ---- Soft-delete (ADMIN-DEL-001) ------------------------------------
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    deleted_by: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    owner = relationship("User", back_populates="resumes")


class SiteSetting(Base):
    """Whole-site configuration, editable from the admin panel without a
    redeploy. One row per top-level group (e.g. 'site', 'branding',
    'plan_limits', 'pricing', 'features', 'email') — `value` holds that
    group's fields as JSON, merged onto defaults in settings_service.py so
    a fresh install works even before an admin ever visits Settings."""
    __tablename__ = "site_settings"

    key: Mapped[str] = mapped_column(String, primary_key=True)   # e.g. "site", "branding", "plan_limits"
    value: Mapped[Any] = mapped_column(JSON, nullable=False, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AuditLogEntry(Base):
    __tablename__ = "audit_log"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    actor_email: Mapped[str] = mapped_column(String, nullable=False)
    action: Mapped[str] = mapped_column(String, nullable=False)
    target: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    before_state: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    after_state: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AiUsageLog(Base):
    """One row per backend AI action per signed-in user. This lets free-tier AI
    limits be enforced SERVER-SIDE (spec: 'usage limits should be enforced by
    the backend, not only by frontend JavaScript') - count today's rows for the
    user before serving an AI request. Pro/teams are unlimited."""
    __tablename__ = "ai_usage_log"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    user_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("users.id"), index=True, nullable=True)  # null = anonymous
    feature: Mapped[str] = mapped_column(String, nullable=False)      # e.g. "check", "enhance-text", "chat"
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class ConfigVersion(Base):
    __tablename__ = "config_versions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    group: Mapped[str] = mapped_column(String, nullable=False, index=True)
    value: Mapped[Any] = mapped_column(JSON, nullable=False)
    changed_by: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AdminIpAllowlist(Base):
    __tablename__ = "admin_ip_allowlist"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    ip_address: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    label: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    added_by: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
