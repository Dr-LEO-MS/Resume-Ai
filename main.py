"""
main.py
-------------------------------------------------------------------------
FastAPI application entrypoint.

Run locally:
    pip install -r requirements.txt
    uvicorn main:app --reload

Then open http://127.0.0.1:8000

Page routes (index, builder, templates, etc.) render Jinja2 templates from
/templates. API routes are mounted under /api/* by the routers in /api/routers.

Every page is rendered through render_page() below, which injects `site` —
the full admin-editable settings dict from settings_service.py — into every
template's context. That's what lets templates read e.g.
{{ site.site.site_name }} or {{ site.features.cover_letters_enabled }}
without each route wiring it up individually, and it's why an admin editing
Settings takes effect on the live site immediately with no redeploy.
-------------------------------------------------------------------------
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from api.database import init_db, get_db, SessionLocal
from api.template_service import reload as reload_templates
from api import settings_service
from api.routers import (
    auth_router,
    resumes_router,
    ai_router,
    export_router,
    misc_router,
    templates_router,
    admin_router,
    upload_router,
    import_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database and load templates
    init_db()
    reload_templates()
    yield
    # Shutdown: nothing to clean up


app = FastAPI(title="Resume AI", version="1.0.0", lifespan=lifespan)

# Security headers middleware (SEC-NET-003 / TRD-ADMIN-001)
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response

# CORS — tighten allow_origins to your real domain(s) in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# ---- API routers ------------------------------------------------------------
app.include_router(auth_router)
app.include_router(resumes_router)
app.include_router(ai_router)
app.include_router(export_router)
app.include_router(misc_router)
app.include_router(templates_router)
app.include_router(admin_router)
app.include_router(upload_router)
app.include_router(import_router)


def render_page(request: Request, template_name: str, active: str, **extra):
    """Renders a Jinja2 page with `site` (admin-editable settings) always
    present in context, plus whatever page-specific `extra` is passed."""
    db: Session = SessionLocal()
    try:
        site = settings_service.get_all(db)
    finally:
        db.close()
    # Build stamp — lets the frontend /api/version check detect a stale
    # client bundle vs the running backend (same SHA as /api/version).
    build_sha = os.getenv("BUILD_SHA", os.getenv("VERCEL_GIT_COMMIT_SHA", "dev"))
    context = {"request": request, "active": active, "site": site, "build_sha": build_sha, **extra}
    return templates.TemplateResponse(request=request, name=template_name, context=context)


# ---- Page routes (Jinja2-rendered HTML) -------------------------------------
@app.get("/")
def page_index(request: Request):
    return render_page(request, "index.html", "home")


@app.get("/login")
def page_login(request: Request):
    return render_page(
        request,
        "login.html",
        "login",
        google_client_id=os.getenv("GOOGLE_CLIENT_ID", ""),
    )


@app.get("/reset-password")
def page_reset_password(request: Request):
    return render_page(request, "reset-password.html", "login")


@app.get("/builder")
def page_builder(request: Request):
    return render_page(request, "builder.html", "builder")


@app.get("/templates")
def page_templates(request: Request):
    return render_page(request, "templates.html", "templates")


@app.get("/preview")
def page_preview(request: Request):
    return render_page(request, "preview.html", "preview")


@app.get("/pricing")
def page_pricing(request: Request):
    return render_page(request, "pricing.html", "pricing")


@app.get("/about")
def page_about(request: Request):
    return render_page(request, "about.html", "about")


@app.get("/contact")
def page_contact(request: Request):
    return render_page(request, "contact.html", "contact")


@app.get("/dashboard")
def page_dashboard(request: Request):
    return render_page(request, "dashboard.html", "dashboard")


@app.get("/admin")
def page_admin(request: Request):
    return render_page(request, "admin.html", "admin")
