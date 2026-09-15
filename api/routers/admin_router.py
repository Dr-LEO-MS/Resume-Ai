"""
routers/admin_router.py
-------------------------------------------------------------------------
Admin-only endpoints for managing users and viewing all resumes.
Implements TRD-ADMIN-001 requirements:
  - 4-tier RBAC (SEC-AUTHZ-002)
  - Soft-delete (ADMIN-DEL-001/002)
  - Enhanced audit logging with IP + before/after state (AUD-LOG-001)
  - Configuration version history (ADMIN-MOD-003)
  - IP allowlisting (SEC-AUTHZ-004)
-------------------------------------------------------------------------
"""

import json
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from .. import models, schemas, auth, settings_service
from ..database import get_db
from ..email_service import send_plan_expiring_soon_email, send_plan_expired_email
from .. import template_service

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _log(
    db: Session,
    admin: models.User,
    action: str,
    request: Request = None,
    target: str = None,
    details: str = None,
    before_state: dict = None,
    after_state: dict = None,
):
    ip = auth.get_client_ip(request) if request else None
    db.add(models.AuditLogEntry(
        actor_email=admin.email,
        action=action,
        target=target,
        details=details,
        ip_address=ip,
        before_state=before_state,
        after_state=after_state,
    ))
    db.commit()


def _remaining_days(expires_at: Optional[datetime]) -> Optional[int]:
    if not expires_at:
        return None
    delta = expires_at - datetime.utcnow()
    return max(0, delta.days)


def _user_snapshot(user: models.User) -> dict:
    return {
        "email": user.email,
        "full_name": user.full_name,
        "plan": user.plan,
        "role": user.role,
    }


require_admin = auth.get_current_admin


# ---- Dashboard Stats -------------------------------------------------------
@router.get("/stats")
def admin_stats(
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    total_users = db.query(func.count(models.User.id)).filter(models.User.is_deleted == False).scalar()
    total_resumes = db.query(func.count(models.Resume.id)).filter(models.Resume.is_deleted == False).scalar()
    plan_counts = dict(
        db.query(models.User.plan, func.count(models.User.id))
        .filter(models.User.is_deleted == False)
        .group_by(models.User.plan)
        .all()
    )
    recent_users = (
        db.query(models.User)
        .filter(models.User.is_deleted == False)
        .order_by(models.User.created_at.desc())
        .limit(5)
        .all()
    )
    return {
        "total_users": total_users,
        "total_resumes": total_resumes,
        "plan_counts": plan_counts,
        "recent_users": [
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "plan": u.plan,
                "role": u.role,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in recent_users
        ],
    }


# ---- RBAC info (SEC-AUTHZ-002) -------------------------------------------
@router.get("/rbac/permissions")
def get_permissions(admin: models.User = Depends(require_admin)):
    return {
        "current_role": admin.role,
        "permissions": sorted(auth.PERMISSION_MATRIX.get(admin.role, set())),
        "all_roles": list(auth.PERMISSION_MATRIX.keys()),
        "permission_matrix": {k: sorted(v) for k, v in auth.PERMISSION_MATRIX.items()},
    }


# ---- Users -----------------------------------------------------------------
@router.get("/users")
def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    include_deleted: bool = False,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_permission("users.read")),
):
    query = db.query(models.User)
    if not include_deleted:
        query = query.filter(models.User.is_deleted == False)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (models.User.email.ilike(pattern)) | (models.User.full_name.ilike(pattern))
        )
    total = query.count()
    users = query.order_by(models.User.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "plan": u.plan,
                "role": u.role,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "resume_count": len([r for r in u.resumes if not r.is_deleted]),
                "plan_started_at": u.plan_started_at.isoformat() if u.plan_started_at else None,
                "plan_expires_at": u.plan_expires_at.isoformat() if u.plan_expires_at else None,
                "remaining_days": _remaining_days(u.plan_expires_at),
                "is_deleted": u.is_deleted,
                "deleted_at": u.deleted_at.isoformat() if u.deleted_at else None,
            }
            for u in users
        ],
    }


@router.get("/users/{user_id}")
def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_permission("users.read")),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "plan": user.plan,
        "role": user.role,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "plan_started_at": user.plan_started_at.isoformat() if user.plan_started_at else None,
        "plan_expires_at": user.plan_expires_at.isoformat() if user.plan_expires_at else None,
        "remaining_days": _remaining_days(user.plan_expires_at),
        "is_deleted": user.is_deleted,
        "deleted_at": user.deleted_at.isoformat() if user.deleted_at else None,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        "last_login_ip": user.last_login_ip,
        "resumes": [
            {
                "id": r.id,
                "name": r.name,
                "template": r.template,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
                "is_deleted": r.is_deleted,
            }
            for r in user.resumes
        ],
    }


@router.put("/users/{user_id}")
def update_user(
    user_id: str,
    payload: schemas.UserUpdateAdmin,
    request: Request,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_permission("users.write")),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    before = _user_snapshot(user)

    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.email is not None:
        existing = db.query(models.User).filter(
            models.User.email == payload.email, models.User.id != user_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        user.email = payload.email
    if payload.plan is not None:
        user.plan = payload.plan
        if payload.plan == "free":
            user.plan_started_at = None
            user.plan_expires_at = None
    if payload.role is not None:
        if not auth.has_permission(admin.role, "roles.write") and payload.role != user.role:
            raise HTTPException(status_code=403, detail="Only Super Admins can change user roles")
        if payload.role not in models.ALL_ROLES:
            raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(models.ALL_ROLES)}")
        user.role = payload.role
    if payload.password is not None:
        pw_error = auth.validate_password_strength(payload.password)
        if pw_error:
            raise HTTPException(status_code=400, detail=pw_error)
        user.hashed_password = auth.hash_password(payload.password)

    if payload.clear_expiry:
        user.plan_expires_at = None
    elif payload.plan_expires_at is not None:
        try:
            user.plan_expires_at = datetime.fromisoformat(payload.plan_expires_at)
        except ValueError:
            raise HTTPException(status_code=400, detail="plan_expires_at must be an ISO date, e.g. 2026-12-31")
    if payload.plan_started_at is not None:
        try:
            user.plan_started_at = datetime.fromisoformat(payload.plan_started_at)
        except ValueError:
            raise HTTPException(status_code=400, detail="plan_started_at must be an ISO date, e.g. 2026-08-22")
    user.expiry_notified_at = None

    db.commit()
    db.refresh(user)
    after = _user_snapshot(user)
    _log(db, admin, "user.update", request, target=user.id,
         details=f"Updated {user.email}", before_state=before, after_state=after)
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "plan": user.plan,
        "role": user.role,
        "plan_started_at": user.plan_started_at.isoformat() if user.plan_started_at else None,
        "plan_expires_at": user.plan_expires_at.isoformat() if user.plan_expires_at else None,
        "remaining_days": _remaining_days(user.plan_expires_at),
    }


# ---- Plan expiry notifications ---------------------------------------------
@router.post("/check-expiring-plans")
def check_expiring_plans(
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    now = datetime.utcnow()
    soon_threshold = now + timedelta(days=3)
    notified_expiring = 0
    notified_expired = 0

    candidates = db.query(models.User).filter(
        models.User.plan.in_(["pro", "teams"]),
        models.User.plan_expires_at.isnot(None),
        models.User.is_deleted == False,
    ).all()

    for user in candidates:
        if user.plan_expires_at < now:
            send_plan_expired_email(user.email, db=db)
            user.plan = "free"
            user.plan_expires_at = None
            user.plan_started_at = None
            notified_expired += 1
        elif user.plan_expires_at <= soon_threshold and not user.expiry_notified_at:
            days_left = max(0, (user.plan_expires_at - now).days)
            send_plan_expiring_soon_email(user.email, days_left, db=db)
            user.expiry_notified_at = now
            notified_expiring += 1

    db.commit()
    return {"notified_expiring_soon": notified_expiring, "downgraded_expired": notified_expired}


# ---- Soft-delete user (ADMIN-DEL-001) --------------------------------------
@router.delete("/users/{user_id}", status_code=200)
def delete_user(
    user_id: str,
    request: Request,
    permanent: bool = Query(False),
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_permission("users.delete")),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_admin:
        admin_count = db.query(func.count(models.User.id)).filter(
            models.User.role.in_(models.ADMIN_ROLES),
            models.User.is_deleted == False,
        ).scalar()
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last admin account")

    if permanent and user.is_deleted:
        _log(db, admin, "user.purge", request, target=user.id,
             details=f"Permanently purged {user.email}")
        db.delete(user)
        db.commit()
        return {"status": "purged", "user_id": user_id}
    else:
        user.is_deleted = True
        user.deleted_at = datetime.utcnow()
        user.deleted_by = admin.email
        db.commit()
        _log(db, admin, "user.soft_delete", request, target=user.id,
             details=f"Soft-deleted {user.email}")
        return {"status": "soft_deleted", "user_id": user_id}


# ---- Restore soft-deleted user (ADMIN-DEL-001) -----------------------------
@router.post("/users/{user_id}/restore")
def restore_user(
    user_id: str,
    request: Request,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_permission("users.write")),
):
    user = db.query(models.User).filter(models.User.id == user_id, models.User.is_deleted == True).first()
    if not user:
        raise HTTPException(status_code=404, detail="Deleted user not found")
    user.is_deleted = False
    user.deleted_at = None
    user.deleted_by = None
    db.commit()
    _log(db, admin, "user.restore", request, target=user.id, details=f"Restored {user.email}")
    return {"status": "restored", "user_id": user_id}


# ---- Resumes (admin view) --------------------------------------------------
@router.get("/resumes")
def list_all_resumes(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    include_deleted: bool = False,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_permission("resumes.read")),
):
    query = db.query(models.Resume).filter(models.Resume.owner_id.isnot(None))
    if not include_deleted:
        query = query.filter(models.Resume.is_deleted == False)
    if search:
        pattern = f"%{search}%"
        query = query.filter(models.Resume.name.ilike(pattern))
    total = query.count()
    resumes = query.order_by(models.Resume.updated_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "resumes": [
            {
                "id": r.id,
                "name": r.name,
                "template": r.template,
                "owner_email": r.owner.email if r.owner else None,
                "owner_name": r.owner.full_name if r.owner else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
                "is_deleted": r.is_deleted,
            }
            for r in resumes
        ],
    }


@router.delete("/resumes/{resume_id}", status_code=200)
def delete_any_resume(
    resume_id: str,
    request: Request,
    permanent: bool = Query(False),
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_permission("resumes.delete")),
):
    resume = db.query(models.Resume).filter(models.Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    if permanent and resume.is_deleted:
        _log(db, admin, "resume.purge", request, target=resume.id,
             details=f"Permanently purged '{resume.name}'")
        db.delete(resume)
        db.commit()
        return {"status": "purged", "resume_id": resume_id}
    else:
        resume.is_deleted = True
        resume.deleted_at = datetime.utcnow()
        resume.deleted_by = admin.email
        db.commit()
        _log(db, admin, "resume.soft_delete", request, target=resume.id,
             details=f"Soft-deleted '{resume.name}' (owner: {resume.owner.email if resume.owner else 'unknown'})")
        return {"status": "soft_deleted", "resume_id": resume_id}


@router.post("/resumes/{resume_id}/restore")
def restore_resume(
    resume_id: str,
    request: Request,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_permission("resumes.delete")),
):
    resume = db.query(models.Resume).filter(models.Resume.id == resume_id, models.Resume.is_deleted == True).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Deleted resume not found")
    resume.is_deleted = False
    resume.deleted_at = None
    resume.deleted_by = None
    db.commit()
    _log(db, admin, "resume.restore", request, target=resume.id, details=f"Restored '{resume.name}'")
    return {"status": "restored", "resume_id": resume_id}


# ---- Site Settings ---------------------------------------------------------
@router.get("/settings")
def get_settings(
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_permission("settings.read")),
):
    return settings_service.get_all(db)


@router.put("/settings/{group}")
def update_settings(
    group: str,
    updates: dict,
    request: Request,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_permission("settings.write")),
):
    if group not in settings_service.DEFAULTS:
        raise HTTPException(status_code=404, detail=f"Unknown settings group: {group}")
    before = settings_service.get_group(db, group, redact=False)
    result = settings_service.update_group(db, group, updates)

    db.add(models.ConfigVersion(
        group=group,
        value=settings_service.get_group(db, group, redact=False),
        changed_by=admin.email,
    ))
    db.commit()

    _log(db, admin, "settings.update", request, target=group,
         details=f"Updated {group}: {list(updates.keys())}",
         before_state=before, after_state=result)
    return result


# ---- Config version history (ADMIN-MOD-003) --------------------------------
@router.get("/settings/{group}/history")
def get_settings_history(
    group: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_permission("config_history.read")),
):
    if group not in settings_service.DEFAULTS:
        raise HTTPException(status_code=404, detail=f"Unknown settings group: {group}")
    query = db.query(models.ConfigVersion).filter(models.ConfigVersion.group == group)
    total = query.count()
    entries = query.order_by(models.ConfigVersion.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "versions": [
            {
                "id": v.id,
                "group": v.group,
                "value": v.value,
                "changed_by": v.changed_by,
                "created_at": v.created_at.isoformat() if v.created_at else None,
            }
            for v in entries
        ],
    }


@router.post("/settings/{group}/revert/{version_id}")
def revert_settings(
    group: str,
    version_id: str,
    request: Request,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_permission("config_history.revert")),
):
    version = db.query(models.ConfigVersion).filter(
        models.ConfigVersion.id == version_id,
        models.ConfigVersion.group == group,
    ).first()
    if not version:
        raise HTTPException(status_code=404, detail="Config version not found")

    before = settings_service.get_group(db, group, redact=False)
    settings_service.update_group(db, group, version.value)

    db.add(models.ConfigVersion(group=group, value=version.value, changed_by=admin.email))
    db.commit()

    _log(db, admin, "settings.revert", request, target=group,
         details=f"Reverted {group} to version {version_id}",
         before_state=before, after_state=version.value)
    return settings_service.get_group(db, group)


# ---- Templates -------------------------------------------------------------
@router.get("/templates")
def list_all_templates(
    admin: models.User = Depends(auth.require_permission("templates.read")),
):
    return template_service.get_all()


@router.patch("/templates/{template_id}")
def update_template(
    template_id: str,
    updates: dict,
    request: Request,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_permission("templates.write")),
):
    allowed_fields = {"name", "desc", "category", "tags", "is_featured", "enabled", "order", "style"}
    filtered = {k: v for k, v in updates.items() if k in allowed_fields}
    result = template_service.save(template_id, filtered)
    if not result:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")
    _log(db, admin, "template.update", request, target=template_id,
         details=f"Updated fields: {list(filtered.keys())}")
    return result


@router.post("/templates/reorder")
def reorder_templates(
    ordered_ids: List[str],
    request: Request,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_permission("templates.write")),
):
    known_ids = set(template_service.get_ids())
    unknown = [i for i in ordered_ids if i not in known_ids]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown template id(s): {unknown}")
    template_service.reorder(ordered_ids)
    _log(db, admin, "template.reorder", request, details=str(ordered_ids))
    return {"order": ordered_ids}


# ---- Audit log --------------------------------------------------------------
@router.get("/audit-log")
def list_audit_log(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    action_filter: Optional[str] = None,
    actor_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_permission("audit_log.read")),
):
    query = db.query(models.AuditLogEntry).order_by(models.AuditLogEntry.created_at.desc())
    if action_filter:
        query = query.filter(models.AuditLogEntry.action.ilike(f"%{action_filter}%"))
    if actor_filter:
        query = query.filter(models.AuditLogEntry.actor_email.ilike(f"%{actor_filter}%"))
    total = query.count()
    entries = query.offset((page - 1) * per_page).limit(per_page).all()
    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "entries": [
            {
                "id": e.id,
                "actor_email": e.actor_email,
                "action": e.action,
                "target": e.target,
                "details": e.details,
                "ip_address": e.ip_address,
                "before_state": e.before_state,
                "after_state": e.after_state,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in entries
        ],
    }


# ---- IP Allowlist (SEC-AUTHZ-004) ------------------------------------------
@router.get("/ip-allowlist")
def get_ip_allowlist(
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_permission("ip_allowlist.read")),
):
    entries = db.query(models.AdminIpAllowlist).order_by(models.AdminIpAllowlist.created_at.desc()).all()
    return {
        "enabled": len(entries) > 0,
        "entries": [
            {
                "id": e.id,
                "ip_address": e.ip_address,
                "label": e.label,
                "added_by": e.added_by,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in entries
        ],
    }


@router.post("/ip-allowlist")
def add_ip_allowlist(
    payload: dict,
    request: Request,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_permission("ip_allowlist.write")),
):
    ip = payload.get("ip_address", "").strip()
    if not ip:
        raise HTTPException(status_code=400, detail="ip_address is required")
    existing = db.query(models.AdminIpAllowlist).filter(models.AdminIpAllowlist.ip_address == ip).first()
    if existing:
        raise HTTPException(status_code=400, detail="IP already in allowlist")
    entry = models.AdminIpAllowlist(
        ip_address=ip,
        label=payload.get("label", ""),
        added_by=admin.email,
    )
    db.add(entry)
    db.commit()
    _log(db, admin, "ip_allowlist.add", request, target=ip, details=f"Added IP {ip} to allowlist")
    return {"id": entry.id, "ip_address": entry.ip_address, "label": entry.label}


@router.delete("/ip-allowlist/{entry_id}")
def remove_ip_allowlist(
    entry_id: str,
    request: Request,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_permission("ip_allowlist.write")),
):
    entry = db.query(models.AdminIpAllowlist).filter(models.AdminIpAllowlist.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="IP allowlist entry not found")
    ip = entry.ip_address
    db.delete(entry)
    db.commit()
    _log(db, admin, "ip_allowlist.remove", request, target=ip, details=f"Removed IP {ip} from allowlist")
    return {"status": "removed"}
