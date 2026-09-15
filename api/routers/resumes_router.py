"""
routers/resumes_router.py
-------------------------------------------------------------------------
Resume Management and Encrypted Token Isolation Endpoints.

Provides:
  1. Standard authenticated CRUD operations for resumes and cover letters.
  2. Cryptographic token generation per resume instance (GET /api/resumes/{id}/token).
  3. Secure token-based resume data retrieval (GET /api/resumes/secure/{token}).
  4. Secure token-based resume updating with write permissions (PUT /api/resumes/secure/{token}).
  5. Plan limits validation for free vs. pro tiers.
-------------------------------------------------------------------------
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas, auth, settings_service
from ..database import get_db
from ..security_tokens import (
    generate_resume_token,
    decrypt_resume_token,
    validate_resume_token,
)

router = APIRouter(prefix="/api/resumes", tags=["resumes"])


def _count_by_type(db: Session, user_id: str, doc_type: str) -> int:
    return (
        db.query(models.Resume)
        .filter(models.Resume.owner_id == user_id, models.Resume.doc_type == doc_type)
        .count()
    )


@router.get("/limits")
def get_limits(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Return remaining quota of resumes/cover letters for user's subscription plan."""
    is_unlimited = current_user.plan in ("pro", "teams")
    limits = settings_service.get_plan_limits(db)
    resume_count = _count_by_type(db, current_user.id, "resume")
    cover_letter_count = _count_by_type(db, current_user.id, "cover_letter")
    return {
        "plan": current_user.plan,
        "unlimited": is_unlimited,
        "resume": {
            "used": resume_count,
            "limit": None if is_unlimited else limits["resume"],
            "can_create": is_unlimited or resume_count < limits["resume"],
        },
        "cover_letter": {
            "used": cover_letter_count,
            "limit": None if is_unlimited else limits["cover_letter"],
            "can_create": is_unlimited or cover_letter_count < limits["cover_letter"],
        },
    }


@router.get("", response_model=List[schemas.ResumeOut])
def list_resumes(
    doc_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """List all resumes belonging to the authenticated user."""
    query = db.query(models.Resume).filter(models.Resume.owner_id == current_user.id)
    if doc_type:
        query = query.filter(models.Resume.doc_type == doc_type)
    return [_serialize(r) for r in query.all()]


@router.post("", response_model=schemas.ResumeOut, status_code=201)
def create_resume(
    payload: schemas.ResumeIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Create a new resume or cover letter for the authenticated user."""
    doc_type = payload.doc_type if payload.doc_type in ("resume", "cover_letter") else "resume"

    if doc_type == "cover_letter" and not settings_service.get_group(db, "features", redact=False).get("cover_letters_enabled", True):
        raise HTTPException(status_code=403, detail="Cover letters are currently disabled site-wide.")

    if current_user.plan not in ("pro", "teams"):
        limits = settings_service.get_plan_limits(db)
        existing_count = _count_by_type(db, current_user.id, doc_type)
        if existing_count >= limits[doc_type]:
            label = "resume" if doc_type == "resume" else "cover letter"
            raise HTTPException(
                status_code=402,
                detail=f"Free plan is limited to {limits[doc_type]} {label}. Upgrade to Pro for unlimited {label}s.",
            )

    resume = models.Resume(
        owner_id=current_user.id,
        name=payload.name or payload.content.get("personal", {}).get("fullName") or "Untitled resume",
        template=payload.template,
        doc_type=doc_type,
        content=payload.content,
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return _serialize(resume)


# ---------------------------------------------------------------------------
# Encrypted Token Management & Isolated Access Endpoints
# ---------------------------------------------------------------------------

@router.get("/secure/{token}")
def get_resume_by_secure_token(token: str, db: Session = Depends(get_db)):
    """
    Retrieve resume data securely using an encrypted instance token.
    Enforces cryptographic signature, expiration, and read permissions without requiring cookies/bearer tokens.
    """
    is_valid, payload, error = validate_resume_token(token, required_permission="read")
    if not is_valid or not payload:
        raise HTTPException(status_code=401, detail=f"Invalid or expired resume token: {error}")

    resume_id = payload.get("rid")
    resume = db.query(models.Resume).filter(models.Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume referenced by token does not exist.")

    return {
        "resume": _serialize(resume),
        "token_meta": {
            "permissions": payload.get("perms"),
            "issued_at": payload.get("iat"),
            "expires_at": payload.get("exp"),
        },
    }


@router.put("/secure/{token}")
def update_resume_by_secure_token(
    token: str,
    payload_in: schemas.ResumeIn,
    db: Session = Depends(get_db),
):
    """
    Update resume data securely using an encrypted instance token with 'write' permission.
    """
    is_valid, payload, error = validate_resume_token(token, required_permission="write")
    if not is_valid or not payload:
        raise HTTPException(status_code=403, detail=f"Token unauthorized for write access: {error}")

    resume_id = payload.get("rid")
    resume = db.query(models.Resume).filter(models.Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found.")

    resume.name = payload_in.name or resume.name
    resume.template = payload_in.template
    resume.content = payload_in.content
    resume.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(resume)
    return _serialize(resume)


@router.get("/{resume_id}/token")
def generate_token_for_resume(
    resume_id: str,
    permissions: Optional[str] = Query("read", description="Comma-separated permissions: read,write,export"),
    expires_in_days: int = Query(30, ge=1, le=365, description="Token validity in days"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Generate an encrypted access token for a specific resume instance.
    Validates that the authenticated user owns the resume.
    """
    resume = _get_owned_resume(db, resume_id, current_user.id)
    perms_list = [p.strip() for p in permissions.split(",") if p.strip()]

    token = generate_resume_token(
        resume_id=resume.id,
        owner_id=current_user.id,
        permissions=perms_list,
        expires_in_seconds=expires_in_days * 86400,
        metadata={"template": resume.template, "doc_type": resume.doc_type},
    )

    return {
        "resume_id": resume.id,
        "token": token,
        "permissions": perms_list,
        "expires_in_days": expires_in_days,
        "secure_url": f"/builder?token={token}",
    }


@router.get("/{resume_id}", response_model=schemas.ResumeOut)
def get_resume(
    resume_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Retrieve an owned resume by ID."""
    resume = _get_owned_resume(db, resume_id, current_user.id)
    return _serialize(resume)


@router.put("/{resume_id}", response_model=schemas.ResumeOut)
def update_resume(
    resume_id: str,
    payload: schemas.ResumeIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Update an owned resume by ID."""
    resume = _get_owned_resume(db, resume_id, current_user.id)
    resume.name = payload.name or resume.name
    resume.template = payload.template
    resume.content = payload.content
    resume.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(resume)
    return _serialize(resume)


@router.delete("/{resume_id}", status_code=204)
def delete_resume(
    resume_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Delete an owned resume."""
    resume = _get_owned_resume(db, resume_id, current_user.id)
    db.delete(resume)
    db.commit()


def _get_owned_resume(db: Session, resume_id: str, user_id: str) -> models.Resume:
    resume = db.query(models.Resume).filter(models.Resume.id == resume_id).first()
    if not resume or resume.owner_id != user_id:
        raise HTTPException(status_code=404, detail="Resume not found")
    return resume


def _serialize(resume: models.Resume) -> dict:
    return {
        "id": resume.id,
        "name": resume.name,
        "template": resume.template,
        "doc_type": resume.doc_type or "resume",
        "content": resume.content,
        "updated_at": resume.updated_at.isoformat(),
    }
