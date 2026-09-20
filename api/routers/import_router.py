"""
routers/import_router.py
-------------------------------------------------------------------------
POST /api/import/resume — accepts an uploaded .pdf, .docx, .doc, .rtf, or
.txt resume, extracts its raw text, then hands that text to
ai_service.parse_resume_text() to turn it into the structured JSON shape
static/js/state.js expects.

POST /api/import/resume-text — accepts raw pasted text (plain or messy
clipboard paste), runs it through the same AI parse pipeline, and returns
structured JSON so the frontend doesn't have to rely on the weak
client-side regex parser.

Both endpoints return {"resume": {...}, "warnings": [...]} so the frontend
can show a review step before committing.
-------------------------------------------------------------------------
"""

import io
import logging
import re

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional

from .. import ai_service

router = APIRouter(prefix="/api/import", tags=["import"])
log = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
ACCEPTED_EXTENSIONS = {".pdf", ".docx", ".doc", ".rtf", ".txt"}


class TextImportRequest(BaseModel):
    text: str


def _validate_parsed_resume(resume: dict) -> list[str]:
    """Return a list of human-readable warnings for fields that look
    incomplete or suspicious after AI parsing."""
    warnings: list[str] = []
    personal = resume.get("personal", {})

    if not personal.get("fullName", "").strip():
        warnings.append("Could not detect a name — please fill it in manually.")
    if not personal.get("email", "").strip():
        warnings.append("No email address found — make sure to add one.")
    if not personal.get("phone", "").strip():
        warnings.append("No phone number detected.")

    if not resume.get("summary", "").strip():
        warnings.append("No professional summary found — consider adding one.")

    exp = resume.get("experience", [])
    if not exp:
        warnings.append("No work experience entries detected — check if the parser missed them.")
    else:
        for i, entry in enumerate(exp):
            if not entry.get("company") and not entry.get("role"):
                warnings.append(f"Experience entry {i + 1} has no company or role — review it.")
            if not entry.get("bullets"):
                warnings.append(f"Experience entry '{entry.get('role', f'#{i + 1}')}' has no bullet points.")

    edu = resume.get("education", [])
    if not edu:
        warnings.append("No education entries found.")

    skills = resume.get("skills", {})
    all_skills = (
        skills.get("technical", []) + skills.get("tools", []) + skills.get("soft", [])
    )
    if not all_skills:
        warnings.append("No skills detected — you may need to add them manually.")

    return warnings


@router.post("/resume")
async def import_resume(file: UploadFile = File(...)):
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File is too large — please upload under 10 MB.")

    filename = (file.filename or "").lower()
    ext = ""
    for e in ACCEPTED_EXTENSIONS:
        if filename.endswith(e):
            ext = e
            break

    if not ext:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type — please upload a .pdf, .docx, .doc, .rtf, or .txt resume.",
        )

    log.info("Import: extracting text from %s (%d bytes)", filename, len(raw))

    if ext == ".pdf" or file.content_type == "application/pdf":
        text = _extract_pdf_text(raw)
    elif ext == ".docx" or "wordprocessingml" in (file.content_type or ""):
        text = _extract_docx_text(raw)
    elif ext == ".doc":
        text = _extract_doc_text(raw)
    elif ext == ".rtf":
        text = _extract_rtf_text(raw)
    else:
        text = raw.decode("utf-8", errors="ignore")

    if not text or not text.strip():
        raise HTTPException(
            status_code=422,
            detail="Couldn't extract any text from this file. If it's a scanned image "
                   "PDF (not selectable text), text extraction won't work — try a "
                   "text-based export instead.",
        )

    log.info("Import: extracted %d chars, sending to AI parser", len(text))

    try:
        resume = ai_service.parse_resume_text(text)
    except Exception as exc:
        log.exception("Import: AI parsing failed")
        raise HTTPException(status_code=502, detail=f"AI parsing failed: {exc}")

    warnings = _validate_parsed_resume(resume)
    return {"resume": resume, "warnings": warnings}


@router.post("/resume-text")
async def import_resume_text(body: TextImportRequest):
    """Parse pasted plain text through the same AI pipeline as file uploads,
    instead of relying on the weak client-side regex parser."""
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="No text provided.")
    if len(text) > 50_000:
        raise HTTPException(status_code=400, detail="Text too long — please keep it under 50,000 characters.")

    log.info("Import text: %d chars, sending to AI parser", len(text))

    try:
        resume = ai_service.parse_resume_text(text)
    except Exception as exc:
        log.exception("Import text: AI parsing failed")
        raise HTTPException(status_code=502, detail=f"AI parsing failed: {exc}")

    warnings = _validate_parsed_resume(resume)
    return {"resume": resume, "warnings": warnings}


# ---------------------------------------------------------------------------
# Text extractors
# ---------------------------------------------------------------------------

def _extract_pdf_text(raw: bytes) -> str:
    try:
        import pdfplumber
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="PDF import requires pdfplumber ('pip install pdfplumber').",
        )
    text_parts = []
    with pdfplumber.open(io.BytesIO(raw)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
    return "\n".join(text_parts)


def _extract_docx_text(raw: bytes) -> str:
    try:
        from docx import Document
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="Word import requires python-docx ('pip install python-docx').",
        )
    doc = Document(io.BytesIO(raw))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


def _extract_doc_text(raw: bytes) -> str:
    """Extract text from legacy .doc files. Uses a basic binary-text
    extraction approach since we don't want a heavy dependency like
    antiword or libreoffice just for .doc support."""
    try:
        text = raw.decode("utf-8", errors="ignore")
    except Exception:
        text = raw.decode("latin-1", errors="ignore")
    cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]", " ", text)
    cleaned = re.sub(r"  +", " ", cleaned)
    lines = [line.strip() for line in cleaned.splitlines() if line.strip()]
    return "\n".join(lines)


def _extract_rtf_text(raw: bytes) -> str:
    """Extract text from RTF files. Uses striprtf if available, otherwise
    falls back to a basic regex approach."""
    try:
        from striprtf.striprtf import rtf_to_text
        return rtf_to_text(raw.decode("utf-8", errors="ignore"))
    except ImportError:
        pass
    text = raw.decode("utf-8", errors="ignore")
    text = re.sub(r"\\[a-z]{1,32}(-?\d{1,10})?[ ]?|\\\*|[{}]|\\[\\{}]", "", text)
    text = re.sub(r"  +", " ", text)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n".join(lines)
