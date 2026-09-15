"""
database.py
-------------------------------------------------------------------------
SQLAlchemy engine + session setup. Defaults to SQLite for zero-config local
development. Swap DATABASE_URL to a Postgres DSN in production, e.g.:

    postgresql+psycopg://user:password@host:5432/resumeai

No other code needs to change — SQLAlchemy handles the dialect switch.
-------------------------------------------------------------------------
"""

import typing
from os import getenv
import sqlalchemy.util.typing as _sa_typing

# Fix SQLAlchemy typing issue on Python 3.14+
if not hasattr(_sa_typing, "_py314_patched"):
    _sa_typing.make_union_type = lambda *types: typing.Union[types]
    _sa_typing._py314_patched = True

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = getenv("DATABASE_URL", "sqlite:///./resumeai.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency — yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_migrations():
    """Small idempotent schema migrations for databases created before a model
    change. `create_all` only creates missing tables — it never adds a column to
    an existing one — so we add new columns explicitly here. Safe to run on
    every startup (checks the current columns first)."""
    try:
        inspector = inspect(engine)
        if "users" in inspector.get_table_names():
            cols = {c["name"] for c in inspector.get_columns("users")}
            new_user_cols = {
                "google_id": "VARCHAR",
                "is_deleted": "BOOLEAN DEFAULT 0",
                "deleted_at": "DATETIME",
                "deleted_by": "VARCHAR",
                "failed_login_attempts": "INTEGER DEFAULT 0",
                "locked_until": "DATETIME",
                "last_login_at": "DATETIME",
                "last_login_ip": "VARCHAR",
                "bio": "TEXT",
                "profile_picture_url": "VARCHAR",
                "profile_slug": "VARCHAR",
                "is_profile_public": "BOOLEAN DEFAULT 0",
                "timezone": "VARCHAR DEFAULT 'UTC'",
                "date_format": "VARCHAR DEFAULT 'MM/DD/YYYY'",
                "locale": "VARCHAR DEFAULT 'en'",
                "notifications_email": "BOOLEAN DEFAULT 1",
                "notifications_product": "BOOLEAN DEFAULT 1",
                "has_set_password": "BOOLEAN DEFAULT 0",
                "token_version": "INTEGER DEFAULT 0",
            }
            with engine.begin() as conn:
                for col_name, col_type in new_user_cols.items():
                    if col_name not in cols:
                        conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                        print(f"[init_db] Migrated users table: added {col_name} column.")

                # Backfill default values for existing rows
                conn.execute(text("UPDATE users SET timezone = 'UTC' WHERE timezone IS NULL"))
                conn.execute(text("UPDATE users SET date_format = 'MM/DD/YYYY' WHERE date_format IS NULL"))
                conn.execute(text("UPDATE users SET locale = 'en' WHERE locale IS NULL"))
                conn.execute(text("UPDATE users SET notifications_email = 1 WHERE notifications_email IS NULL"))
                conn.execute(text("UPDATE users SET notifications_product = 1 WHERE notifications_product IS NULL"))
                conn.execute(text("UPDATE users SET is_profile_public = 0 WHERE is_profile_public IS NULL"))
                conn.execute(text("UPDATE users SET token_version = 0 WHERE token_version IS NULL"))
                conn.execute(text("UPDATE users SET is_deleted = 0 WHERE is_deleted IS NULL"))
                conn.execute(text("UPDATE users SET failed_login_attempts = 0 WHERE failed_login_attempts IS NULL"))
                conn.execute(text("UPDATE users SET has_set_password = 1 WHERE google_id IS NULL AND (has_set_password = 0 OR has_set_password IS NULL)"))

        if "resumes" in inspector.get_table_names():
            cols = {c["name"] for c in inspector.get_columns("resumes")}
            new_resume_cols = {
                "is_deleted": "BOOLEAN DEFAULT 0",
                "deleted_at": "DATETIME",
                "deleted_by": "VARCHAR",
            }
            with engine.begin() as conn:
                for col_name, col_type in new_resume_cols.items():
                    if col_name not in cols:
                        conn.execute(text(f"ALTER TABLE resumes ADD COLUMN {col_name} {col_type}"))
                        print(f"[init_db] Migrated resumes table: added {col_name} column.")

        if "audit_log" in inspector.get_table_names():
            cols = {c["name"] for c in inspector.get_columns("audit_log")}
            new_audit_cols = {
                "ip_address": "VARCHAR",
                "before_state": "JSON",
                "after_state": "JSON",
                "created_at": "DATETIME",
            }
            with engine.begin() as conn:
                for col_name, col_type in new_audit_cols.items():
                    if col_name not in cols:
                        conn.execute(text(f"ALTER TABLE audit_log ADD COLUMN {col_name} {col_type}"))
                        print(f"[init_db] Migrated audit_log table: added {col_name} column.")

        # Migrate existing 'admin' role to 'super_admin'
        if "users" in inspector.get_table_names():
            with engine.begin() as conn:
                conn.execute(text("UPDATE users SET role = 'super_admin' WHERE role = 'admin'"))

    except Exception as err:
        print(f"[init_db] Migration notice (safe to ignore if fresh DB): {err}")


def init_db():
    """Create tables on startup if they don't exist yet, apply small idempotent
    schema migrations, and seed default admin."""
    from . import models, auth  # noqa: F401
    Base.metadata.create_all(bind=engine)
    run_migrations()

    # Seed default admin account if non-existent
    db = SessionLocal()
    try:
        admin_email = getenv("ADMIN_EMAIL", "admin@resumeai.com")
        admin_pass = getenv("ADMIN_PASSWORD", "admin12345678901")
        existing_admin = db.query(models.User).filter(models.User.email == admin_email).first()
        if not existing_admin:
            admin_user = models.User(
                email=admin_email,
                hashed_password=auth.hash_password(admin_pass),
                full_name="System Admin",
                plan="pro",
                role="super_admin",
            )
            db.add(admin_user)
            db.commit()
            print(f"[init_db] Default admin user initialized: {admin_email}")
    except Exception as err:
        db.rollback()
        print(f"[init_db] Admin seed notice: {err}")
    finally:
        db.close()

