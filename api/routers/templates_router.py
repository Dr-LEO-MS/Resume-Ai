"""
routers/templates_router.py
-------------------------------------------------------------------------
Resume Template API Endpoints.

Provides:
  GET  /api/templates                — List all available resume templates
  GET  /api/templates/{id}           — Get a single template by id
  GET  /api/templates/{id}/raw       — Get raw modular HTML template presentation markup
  POST /api/templates/{id}/render    — Dynamically render template with resume payload
  POST /api/templates/reload         — Hot-reload template registry from disk
-------------------------------------------------------------------------
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Response

from ..template_service import (
    get_all,
    get_by_id,
    get_public,
    get_raw_html,
    render_template_html,
    reload as reload_templates,
)

router = APIRouter(prefix="/api/templates", tags=["templates"])


class RenderRequest(BaseModel):
    resume: Dict[str, Any]


@router.get("", response_model=List[dict])
def list_templates():
    """Return templates visible to end users, sorted by admin order."""
    return get_public()


@router.get("/all", response_model=List[dict])
def list_all_templates():
    """Return all discovered templates including disabled ones."""
    return get_all()


@router.post("/reload")
def reload_registry():
    """Hot-reload templates from disk."""
    reload_templates()
    templates = get_all()
    return {"status": "ok", "count": len(templates), "templates": [t["id"] for t in templates]}


@router.get("/{template_id}")
def get_template(template_id: str):
    """Return a single template metadata by id."""
    template = get_by_id(template_id)
    if not template:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")
    return template


@router.get("/{template_id}/raw")
def get_template_raw_html(template_id: str):
    """Return the raw HTML template layout for client-side rendering or customization."""
    html = get_raw_html(template_id)
    if not html:
        raise HTTPException(status_code=404, detail=f"HTML layout for template '{template_id}' not found")
    return Response(content=html, media_type="text/html")


@router.post("/{template_id}/render")
def render_template(template_id: str, payload: RenderRequest):
    """Dynamically render the template HTML with supplied resume data."""
    template = get_by_id(template_id)
    if not template:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")
    rendered_html = render_template_html(template_id, payload.resume)
    return {
        "template_id": template_id,
        "html": rendered_html,
    }
