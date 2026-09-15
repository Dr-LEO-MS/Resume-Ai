"""
routers/misc_router.py
-------------------------------------------------------------------------
POST /api/contact   — contact form submission (wire up to email/CRM)
GET  /r/{slug}       — public read-only view of a shared resume
-------------------------------------------------------------------------
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from .. import schemas, models
from ..database import get_db
from ..routers.export_router import render_html

router = APIRouter(tags=["misc"])
templates = Jinja2Templates(directory="templates")


@router.post("/api/contact")
def submit_contact(payload: schemas.ContactRequest):
    # TODO: wire this up to an email provider (e.g. SendGrid/SES) or a CRM.
    # Kept as a log line so the endpoint is functional out of the box.
    print(f"[contact] {payload.name} <{payload.email}>: {payload.message}")
    return {"status": "received"}


@router.get("/r/{slug}", response_class=HTMLResponse)
def view_shared_resume(slug: str, db: Session = Depends(get_db)):
    resume = db.query(models.Resume).filter(models.Resume.share_slug == slug, models.Resume.is_public == True).first()
    if not resume:
        raise HTTPException(status_code=404, detail="This resume link doesn't exist or is no longer shared.")
    return HTMLResponse(content=f"""
      <html><head><link rel="stylesheet" href="/static/css/styles.css"></head>
      <body style="background:var(--bg-recessed);display:flex;justify-content:center;padding:48px 16px">
        {render_html(resume.content).split('<body>')[1].split('</body>')[0]}
      </body></html>""")
