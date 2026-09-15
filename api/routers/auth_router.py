"""
routers/auth.py
-------------------------------------------------------------------------
POST /api/auth/register          — create account
POST /api/auth/login             — returns a JWT access token
GET  /api/auth/me                — current user (requires Authorization: Bearer)
POST /api/auth/forgot-password   — issues a reset token (emailed in production)
POST /api/auth/reset-password    — consumes a reset token, sets a new password
-------------------------------------------------------------------------
"""

from datetime import datetime, timedelta
import io
from pathlib import Path
import re
import secrets
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from PIL import Image, ImageOps
from sqlalchemy.orm import Session

# Pillow ≥10 moved LANCZOS under Image.Resampling; older stubs/versions
# expose Image.LANCZOS. Resolve via getattr so both Pylance (old stubs)
# and every runtime Pillow stay happy.
_LANCZOS: int = int(
    getattr(getattr(Image, "Resampling", Image), "LANCZOS", getattr(Image, "LANCZOS", 1))
)

from .. import models, schemas, auth
from ..database import get_db
from ..email_service import send_password_reset_email
from ..google_auth import verify_id_token, GoogleAuthError

router = APIRouter(prefix="/api/auth", tags=["auth"])

AVATAR_DIR = Path(__file__).resolve().parent.parent.parent / "static" / "uploads" / "avatars"
try:
    AVATAR_DIR.mkdir(parents=True, exist_ok=True)
except OSError:
    # Serverless deploy dir (e.g. Vercel) is read-only: fall back to a writable
    # temp dir so the app still boots. Files written there are ephemeral.
    import tempfile
    AVATAR_DIR = Path(tempfile.gettempdir()) / "resumeai" / "avatars"
    AVATAR_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_AVATAR_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
MAX_AVATAR_BYTES = 8 * 1024 * 1024


@router.post("/register", response_model=schemas.TokenOut, status_code=status.HTTP_201_CREATED)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    pw_error = auth.validate_password_strength(payload.password)
    if pw_error:
        raise HTTPException(status_code=400, detail=pw_error)

    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    user = models.User(
        email=payload.email,
        hashed_password=auth.hash_password(payload.password),
        full_name=payload.full_name or "",
        has_set_password=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = auth.create_access_token(user.id, user.token_version or 0)
    return {"access_token": token, "user": user}


@router.post("/login", response_model=schemas.TokenOut)
def login(payload: schemas.UserLogin, request: Request, db: Session = Depends(get_db)):
    client_ip = auth.get_client_ip(request)

    if not auth.check_ip_rate_limit(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts from this IP. Please try again later."
        )

    user = db.query(models.User).filter(
        models.User.email == payload.email,
        models.User.is_deleted == False,
    ).first()
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    lockout_msg = auth.check_account_lockout(user)
    if lockout_msg:
        raise HTTPException(status_code=status.HTTP_423_LOCKED, detail=lockout_msg)

    if not auth.verify_password(payload.password, user.hashed_password):
        auth.record_failed_login(user, db)
        remaining = auth.MAX_FAILED_LOGIN_ATTEMPTS - (user.failed_login_attempts or 0)
        detail = "Incorrect email or password"
        if remaining <= 2 and remaining > 0:
            detail += f" ({remaining} attempt(s) remaining before lockout)"
        raise HTTPException(status_code=401, detail=detail)

    auth.record_successful_login(user, client_ip, db)
    token = auth.create_access_token(user.id, user.token_version or 0)
    return {"access_token": token, "user": user}


@router.post("/google", response_model=schemas.TokenOut)
def google_login(payload: schemas.GoogleAuthRequest, request: Request, db: Session = Depends(get_db)):
    try:
        claims = verify_id_token(payload.credential)
    except GoogleAuthError as exc:
        raise HTTPException(status_code=401, detail=f"Google sign-in failed: {exc}")

    google_id = claims["google_id"]
    email = claims["email"]

    user = db.query(models.User).filter(models.User.google_id == google_id).first()
    if not user:
        by_email = db.query(models.User).filter(models.User.email == email).first()
        if by_email:
            by_email.google_id = google_id
            if not by_email.full_name and claims["full_name"]:
                by_email.full_name = claims["full_name"]
            db.commit()
            db.refresh(by_email)
            user = by_email
    if not user:
        dummy_hash = auth.hash_password(secrets.token_urlsafe(32))
        user = models.User(
            email=email,
            hashed_password=dummy_hash,
            google_id=google_id,
            full_name=claims["full_name"],
            has_set_password=False,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    client_ip = auth.get_client_ip(request)
    auth.record_successful_login(user, client_ip, db)
    token = auth.create_access_token(user.id, user.token_version or 0)
    return {"access_token": token, "user": user}


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user


@router.get("/me/extended", response_model=schemas.UserOutExtended)
def me_extended(current_user: models.User = Depends(auth.get_current_user)):
    return current_user


@router.put("/change-password")
def change_password(
    payload: schemas.ChangePasswordRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    requires_current_pw = current_user.has_set_password or not current_user.google_id
    if requires_current_pw:
        if not payload.current_password or not auth.verify_password(payload.current_password, current_user.hashed_password):
            raise HTTPException(status_code=400, detail="Current password is incorrect.")

    pw_error = auth.validate_password_strength(payload.new_password)
    if pw_error:
        raise HTTPException(status_code=400, detail=pw_error)

    current_user.hashed_password = auth.hash_password(payload.new_password)
    current_user.has_set_password = True
    db.commit()
    return {"message": "Password updated successfully."}


@router.put("/update-profile", response_model=schemas.UserOutExtended)
def update_profile(
    payload: schemas.UpdateProfileRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    if payload.full_name is not None:
        current_user.full_name = payload.full_name.strip()

    if payload.bio is not None:
        bio_val = payload.bio.strip()
        if len(bio_val) > 200:
            raise HTTPException(status_code=400, detail="Bio cannot exceed 200 characters.")
        current_user.bio = bio_val

    if payload.profile_slug is not None:
        slug = payload.profile_slug.strip().lower()
        if slug:
            if not re.match(r"^[a-z0-9\-]{3,30}$", slug):
                raise HTTPException(status_code=400, detail="Profile slug must be 3-30 lowercase alphanumeric characters or hyphens.")
            existing = db.query(models.User).filter(
                models.User.profile_slug == slug,
                models.User.id != current_user.id,
                models.User.is_deleted == False,
            ).first()
            if existing:
                raise HTTPException(status_code=400, detail="This profile slug is already taken.")
            current_user.profile_slug = slug
        else:
            current_user.profile_slug = None

    if payload.is_profile_public is not None:
        current_user.is_profile_public = payload.is_profile_public

    db.commit()
    db.refresh(current_user)
    return current_user


@router.put("/update-email", response_model=schemas.TokenOut)
def update_email(
    payload: schemas.UpdateEmailRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    requires_current_pw = current_user.has_set_password or not current_user.google_id
    if requires_current_pw:
        if not payload.current_password or not auth.verify_password(payload.current_password, current_user.hashed_password):
            raise HTTPException(status_code=400, detail="Current password is incorrect.")

    new_email = payload.new_email.strip().lower()
    if new_email == current_user.email.lower():
        raise HTTPException(status_code=400, detail="New email must be different from current email.")

    existing = db.query(models.User).filter(
        models.User.email == new_email,
        models.User.id != current_user.id,
        models.User.is_deleted == False,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    current_user.email = new_email
    db.commit()
    db.refresh(current_user)

    token = auth.create_access_token(current_user.id, current_user.token_version or 0)
    return {"access_token": token, "user": current_user}


@router.put("/update-preferences", response_model=schemas.UserOutExtended)
def update_preferences(
    payload: schemas.UpdatePreferencesRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    if payload.timezone is not None:
        current_user.timezone = payload.timezone
    if payload.date_format is not None:
        current_user.date_format = payload.date_format
    if payload.locale is not None:
        current_user.locale = payload.locale
    if payload.notifications_email is not None:
        current_user.notifications_email = payload.notifications_email
    if payload.notifications_product is not None:
        current_user.notifications_product = payload.notifications_product

    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/upload-avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    if file.content_type not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, and WebP images are supported.")

    raw = await file.read()
    if len(raw) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=400, detail="Avatar image is too large — please upload a file under 8MB.")

    try:
        image = Image.open(io.BytesIO(raw))
        image = ImageOps.exif_transpose(image)
        image = image.convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not process image — it may be corrupted.")

    # Resize/crop to 400x400
    image.thumbnail((400, 400), _LANCZOS)

    filename = f"avatar-{current_user.id}-{uuid.uuid4().hex[:8]}.jpg"
    filepath = AVATAR_DIR / filename
    image.save(filepath, format="JPEG", quality=85, optimize=True)

    url = f"/static/uploads/avatars/{filename}"
    current_user.profile_picture_url = url
    db.commit()

    return {"url": url}


@router.delete("/remove-avatar")
def remove_avatar(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    current_user.profile_picture_url = None
    db.commit()
    return {"message": "Avatar removed successfully."}


@router.post("/sign-out-all", response_model=schemas.TokenOut)
def sign_out_all(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    current_user.token_version = (current_user.token_version or 0) + 1
    db.commit()
    db.refresh(current_user)

    token = auth.create_access_token(current_user.id, current_user.token_version)
    return {"access_token": token, "user": current_user}


@router.post("/delete-account")
def delete_account(
    payload: schemas.DeleteAccountRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    if payload.confirmation.strip() != "DELETE":
        raise HTTPException(status_code=400, detail="Please type DELETE to confirm account deletion.")

    requires_current_pw = current_user.has_set_password or not current_user.google_id
    if requires_current_pw:
        if not payload.current_password or not auth.verify_password(payload.current_password, current_user.hashed_password):
            raise HTTPException(status_code=400, detail="Incorrect password.")

    current_user.is_deleted = True
    current_user.deleted_at = datetime.utcnow()
    current_user.deleted_by = current_user.email
    current_user.token_version = (current_user.token_version or 0) + 1
    db.commit()
    return {"message": "Account successfully deleted."}


@router.post("/forgot-password")
def forgot_password(payload: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if user:
        reset_token = auth.generate_reset_token()
        user.reset_token = reset_token
        user.reset_token_expires = datetime.utcnow() + timedelta(minutes=auth.RESET_TOKEN_EXPIRE_MINUTES)
        db.commit()
        if user.email:
            send_password_reset_email(user.email, reset_token, db=db)
    return {"message": "If an account exists for that email, a reset link has been sent."}


@router.post("/reset-password")
def reset_password(payload: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    pw_error = auth.validate_password_strength(payload.new_password)
    if pw_error:
        raise HTTPException(status_code=400, detail=pw_error)

    user = (
        db.query(models.User)
        .filter(models.User.reset_token == payload.token)
        .first()
    )
    if not user or not user.reset_token_expires or user.reset_token_expires < datetime.utcnow():
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired.")

    user.hashed_password = auth.hash_password(payload.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    user.has_set_password = True
    db.commit()
    return {"message": "Password updated. You can now sign in with your new password."}
