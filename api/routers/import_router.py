"""
routers/import_router.py
-------------------------------------------------------------------------
POST /api/import/resume — accepts an uploaded .pdf or .docx resume,
extracts its raw text (pdfplumber for PDF, python-docx for Word), then
hands that text to ai_service.parse_resume_text() to turn it into the
structured JSON shape static/js/state.js expects. The frontend loads the
result straight into ResumeState so the user lands in the builder with
their existing content pre-filled, ready to review and polish.
-------------------------------------------------------------------------
"""

import io

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from .. import ai_service

router = APIRouter(prefix="/api/import", tags=["import"])

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10MB


@router.post("/resume")
async def import_resume(
    file: UploadFile = File(...),
):
    # Anonymous-friendly on purpose, same as the AI review/enhance endpoints —
    # current_user was declared here before but never actually used, it just
    # silently 401'd every logged-out visitor who clicked Import.
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File is too large — please upload under 10MB.")

    filename = (file.filename or "").lower()
    warnings = []

    if filename.endswith(".pdf") or file.content_type == "application/pdf":
        text = _extract_pdf_text(raw)
    elif filename.endswith(".docx") or "wordprocessingml" in (file.content_type or ""):
        text = _extract_docx_text(raw)
    elif filename.endswith(".txt"):
        text = raw.decode("utf-8", errors="ignore")
    else:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type — please upload a .pdf, .docx, or .txt resume.",
        )

    if not text or not text.strip():
        raise HTTPException(
            status_code=422,
            detail="Couldn't extract any text from this file. If it's a scanned image "
                   "PDF (not selectable text), text extraction won't work — try a "
                   "text-based export instead.",
        )

    try:
        resume = ai_service.parse_resume_text(text)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI parsing failed: {exc}")

    return {"resume": resume, "warnings": warnings}


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
