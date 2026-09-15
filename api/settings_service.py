"""
settings_service.py
-------------------------------------------------------------------------
Central store for every whole-site setting the admin panel can edit:
site content/copy, branding, plan limits, pricing display, feature flags,
and outbound-email config. Backed by the `site_settings` table (one row per
group), merged onto DEFAULTS so a fresh install works with sensible values
before an admin ever opens Settings.

Usage:
    from . import settings_service as settings
    site = settings.get_group(db, "site")          # -> dict, defaults + overrides
    all_ = settings.get_all(db)                     # -> {"site": {...}, "branding": {...}, ...}
    settings.update_group(db, "features", {"ai_review_enabled": False})

Every page route in main.py calls get_all() once and passes it into the
Jinja context as `site`, so templates can read e.g. {{ site.site.site_name }}
or {{ site.features.cover_letters_enabled }} without any per-page plumbing.
-------------------------------------------------------------------------
"""

from typing import Any, Dict
from sqlalchemy.orm import Session

from . import models

DEFAULTS: Dict[str, Dict[str, Any]] = {
    "site": {
        "site_name": "Resume AI",
        "hero_headline": "Write it once. Let the AI make it hireable.",
        "hero_subheadline": "Resume AI checks your resume line by line — grammar, clarity, keywords, ATS formatting — then rewrites the weak parts for you. You keep final say on every change.",
        "footer_tagline": "AI-checked, AI-enhanced resumes that pass the bots and impress the humans.",
        "contact_email": "hello@resumeai.example",
        "support_email": "support@resumeai.example",
    },
    "branding": {
        "primary_color": "#5b5bd6",
        "accent_color": "#d98f34",
        "logo_text": "Resume AI",
    },
    "plan_limits": {
        "free_resume_limit": 1,
        "free_cover_letter_limit": 1,
    },
    "pricing": {
        "free_price": "$0",
        "free_period": "",
        "pro_price": "$12",
        "pro_period": "/month",
        "teams_price": "Custom",
    },
    "features": {
        "ai_review_enabled": True,
        "ai_enhance_enabled": True,
        "cover_letters_enabled": True,
        "sharing_enabled": True,
        "registration_enabled": True,
        "pdf_export_enabled": True,
        "docx_export_enabled": True,
    },
    "email": {
        "smtp_host": "",
        "smtp_port": 587,
        "smtp_user": "",
        "smtp_from": "no-reply@resumeai.example",
        "smtp_password": "",  # write-only from the admin UI; redacted on read, see get_group()
    },
}

_REDACT_FIELDS = {"email": {"smtp_password"}}


def get_group(db: Session, group: str, *, redact: bool = True) -> Dict[str, Any]:
    """Returns one settings group, defaults merged with any DB override."""
    base = dict(DEFAULTS.get(group, {}))
    row = db.query(models.SiteSetting).filter(models.SiteSetting.key == group).first()
    if row and isinstance(row.value, dict):
        base.update(row.value)
    if redact:
        for field in _REDACT_FIELDS.get(group, ()):
            if base.get(field):
                base[field] = "••••••••"
    return base


def get_all(db: Session, *, redact: bool = True) -> Dict[str, Dict[str, Any]]:
    return {group: get_group(db, group, redact=redact) for group in DEFAULTS}


def update_group(db: Session, group: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    """Merges `updates` onto the group's current (unredacted) values and
    persists. Unknown keys are ignored so a stray field in a request body
    can't silently create new, unvalidated config."""
    if group not in DEFAULTS:
        raise ValueError(f"Unknown settings group: {group}")

    current = get_group(db, group, redact=False)
    for key, value in updates.items():
        if key not in DEFAULTS[group]:
            continue
        # A redacted placeholder coming back from the UI (user didn't touch
        # the password field) should never overwrite the real stored value.
        if key in _REDACT_FIELDS.get(group, ()) and value == "••••••••":
            continue
        current[key] = value

    row = db.query(models.SiteSetting).filter(models.SiteSetting.key == group).first()
    if row:
        row.value = current
    else:
        row = models.SiteSetting(key=group, value=current)
        db.add(row)
    db.commit()
    return get_group(db, group)


def get_plan_limits(db: Session) -> Dict[str, int]:
    limits = get_group(db, "plan_limits", redact=False)
    return {
        "resume": int(limits.get("free_resume_limit", 1)),
        "cover_letter": int(limits.get("free_cover_letter_limit", 1)),
        # Free-tier daily AI action budget (spec §10 — enforced server-side in
        # ai_router via AiUsageLog; pro/teams are unlimited).
        "ai_actions_free_per_day": int(limits.get("ai_actions_free_per_day", 15)),
    }


def get_smtp_config(db: Session) -> Dict[str, Any]:
    """Unredacted email config for actually sending mail — only email_service.py
    should call this with redact=False; admin API responses always redact."""
    return get_group(db, "email", redact=False)
