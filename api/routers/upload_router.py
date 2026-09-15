"""
routers/upload_router.py
-------------------------------------------------------------------------
POST /api/upload/photo — accepts a JPG/PNG profile photo, validates size,
downsizes and compresses it with Pillow, and saves it under
/static/uploads/photos/. Returns the public URL to store in
resume.customization.photo.url.
-------------------------------------------------------------------------
"""

import io
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from PIL import Image, ImageOps

from .. import models, auth

router = APIRouter(prefix="/api/upload", tags=["upload"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "static" / "uploads" / "photos"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_UPLOAD_BYTES = 8 * 1024 * 1024  # 8MB raw upload ceiling, before compression
MAX_DIMENSION = 800  # px — resumes never need a larger photo than this
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/jpg", "image/png"}


@router.post("/photo")
async def upload_photo(
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_user),
):
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Only JPG and PNG images are supported.")

    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Image is too large — please upload a file under 8MB.")

    try:
        image = Image.open(io.BytesIO(raw))
        image = ImageOps.exif_transpose(image)  # respect phone-camera orientation
        image = image.convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read this image — it may be corrupted.")

    # Downscale to a sensible max dimension, preserving aspect ratio.
    image.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.LANCZOS)

    filename = f"{current_user.id}-{uuid.uuid4().hex[:8]}.jpg"
    filepath = UPLOAD_DIR / filename
    # Compress: quality=82 keeps faces sharp while cutting file size significantly.
    image.save(filepath, format="JPEG", quality=82, optimize=True)

    return {"url": f"/static/uploads/photos/{filename}"}
