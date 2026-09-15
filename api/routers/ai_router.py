"""
routers/ai_router.py
-------------------------------------------------------------------------
POST /api/ai/check         — full resume analysis + score + suggestions
POST /api/ai/enhance       — full resume rewrite
POST /api/ai/enhance-text  — single field (bullet/summary) rewrite
POST /api/ai/generate      — starter content from a job title
POST /api/ai/suggest-skills — infers missing skills from real experience
POST /api/ai/chat           — multi-turn resume-grounded assistant ("AI Assistant")

Open to anonymous users so the free tier can review without an account;
add a rate limiter (e.g. slowapi) keyed on IP for production to enforce
the "3 AI reviews / month" free-tier limit described on the pricing page.

Each endpoint checks the corresponding feature flag from Settings ->
Features first (an admin can disable AI Review / AI Enhance site-wide from
/admin), so this is real server-side control, not just a hidden button.
-------------------------------------------------------------------------
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas, ai_service, ai_tools, settings_service, auth
from ..database import get_db

router = APIRouter(prefix="/api/ai", tags=["ai"])


def _require_feature(db: Session, flag: str, label: str):
    features = settings_service.get_group(db, "features", redact=False)
    if not features.get(flag, True):
        raise HTTPException(status_code=403, detail=f"{label} is currently disabled site-wide.")


def _enforce_ai_quota(db: Session, user: Optional[models.User], feature: str):
    """Server-side free-tier AI limit (spec §10). Counts today's AiUsageLog rows
    for signed-in free users; pro/teams are unlimited. Anonymous users get a
    smaller fixed daily allowance (per-IP limiting is a production TODO — see
    the module docstring)."""
    if user and user.plan in ("pro", "teams"):
        return
    limits = settings_service.get_plan_limits(db)
    cap = limits["ai_actions_free_per_day"] if user else 5
    day_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    query = db.query(models.AiUsageLog).filter(models.AiUsageLog.created_at >= day_start)
    query = query.filter(models.AiUsageLog.user_id == (user.id if user else None))
    if query.count() >= cap:
        raise HTTPException(
            status_code=402,
            detail=f"Free plan allows {cap} AI actions per day. Upgrade to Pro for unlimited AI.",
        )
    db.add(models.AiUsageLog(user_id=(user.id if user else None), feature=feature))
    db.commit()


def _current_user_optional(
    token: str = Depends(auth.oauth2_scheme), db: Session = Depends(get_db)
) -> Optional[models.User]:
    """Resolves the caller for quota accounting without blocking anonymous use."""
    return auth.get_current_user_optional(token=token, db=db)


@router.post("/check", response_model=schemas.AICheckResponse)
def check(payload: schemas.AICheckRequest, db: Session = Depends(get_db),
          user: Optional[models.User] = Depends(_current_user_optional)):
    _require_feature(db, "ai_review_enabled", "AI Review")
    _enforce_ai_quota(db, user, "check")
    try:
        result = ai_service.check_resume(payload.resume, payload.target_role, payload.job_description)
        return result
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI check failed: {exc}")


@router.post("/enhance", response_model=schemas.AIEnhanceResponse)
def enhance(payload: schemas.AIEnhanceRequest, db: Session = Depends(get_db),
            user: Optional[models.User] = Depends(_current_user_optional)):
    _require_feature(db, "ai_enhance_enabled", "AI Enhance")
    _enforce_ai_quota(db, user, "enhance")
    try:
        rewritten = ai_service.enhance_resume(payload.resume)
        return {"resume": rewritten}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI enhance failed: {exc}")


@router.post("/enhance-text", response_model=schemas.AIEnhanceTextResponse)
def enhance_text(payload: schemas.AIEnhanceTextRequest, db: Session = Depends(get_db),
                 user: Optional[models.User] = Depends(_current_user_optional)):
    _require_feature(db, "ai_enhance_enabled", "AI Enhance")
    _enforce_ai_quota(db, user, "enhance-text")
    try:
        suggested = ai_service.enhance_text(payload.text, payload.kind, payload.context)
        return {"original": payload.text, "suggested": suggested}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI enhance-text failed: {exc}")


@router.post("/generate", response_model=schemas.AIGenerateResponse)
def generate(payload: schemas.AIGenerateRequest, db: Session = Depends(get_db),
             user: Optional[models.User] = Depends(_current_user_optional)):
    """Generates starter content (summary / experience bullets / skills) from
    just a job title — used by the 'Generate with AI' buttons in the builder
    for people starting from a blank section."""
    _require_feature(db, "ai_enhance_enabled", "AI generation")
    _enforce_ai_quota(db, user, "generate")
    if payload.kind not in ("summary", "bullets", "skills", "cover_letter"):
        raise HTTPException(status_code=400, detail="kind must be 'summary', 'bullets', 'skills', or 'cover_letter'")
    try:
        result = ai_service.generate_content(payload.kind, payload.job_title, payload.context)
        return {"kind": payload.kind, "result": result}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI generate failed: {exc}")


@router.post("/suggest-skills", response_model=schemas.AISuggestSkillsResponse)
def suggest_skills(payload: schemas.AISuggestSkillsRequest, db: Session = Depends(get_db),
                   user: Optional[models.User] = Depends(_current_user_optional)):
    """Suggests additional skills the candidate plausibly has but hasn't
    listed, inferred from their actual job titles and experience bullets —
    powers the 'AI suggest' button in the Skills section of the builder."""
    _require_feature(db, "ai_review_enabled", "AI Review")
    _enforce_ai_quota(db, user, "suggest-skills")
    try:
        result = ai_service.suggest_skills(payload.resume)
        return result
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI suggest-skills failed: {exc}")


@router.post("/chat", response_model=schemas.AIChatResponse)
def chat(payload: schemas.AIChatRequest, db: Session = Depends(get_db),
         user: Optional[models.User] = Depends(_current_user_optional)):
    """Multi-turn, resume-grounded assistant for the builder's 'AI Assistant'
    modal. `messages` is the recent user/assistant history; the current resume
    is sent along as grounding so answers reference the candidate's real
    content."""
    _require_feature(db, "ai_review_enabled", "AI Review")
    _enforce_ai_quota(db, user, "chat")
    try:
        turns = [
            {"role": m.role, "content": m.content}
            for m in payload.messages
            if m.role in ("user", "assistant")
        ]
        reply = ai_service.chat_with_resume(turns, payload.resume)
        return {"reply": reply}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI chat failed: {exc}")


@router.post("/keywords", response_model=schemas.AIKeywordsResponse)
def keywords(payload: schemas.AIKeywordsRequest, db: Session = Depends(get_db),
             user: Optional[models.User] = Depends(_current_user_optional)):
    """Job-description keyword match (spec §6): matched vs missing keywords,
    match %, and where a missing keyword could NATURALLY fit if true."""
    _require_feature(db, "ai_review_enabled", "Keyword analysis")
    _enforce_ai_quota(db, user, "keywords")
    try:
        return ai_tools.analyze_keywords(payload.resume, payload.job_description)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Keyword analysis failed: {exc}")


@router.post("/check-links", response_model=schemas.AILinksCheckResponse)
def check_links(payload: schemas.AISuggestSkillsRequest, db: Session = Depends(get_db),
                user: Optional[models.User] = Depends(_current_user_optional)):
    """Reviews portfolio/LinkedIn/GitHub/project links for presence, length and
    duplicates. Format review only — this never claims a link actually works
    (spec §16). No AI quota charged: it's a pure local check."""
    return ai_tools.check_links(payload.resume)


@router.post("/action-verbs", response_model=schemas.AIActionVerbsResponse)
def action_verbs(payload: schemas.AISuggestSkillsRequest, db: Session = Depends(get_db),
                 user: Optional[models.User] = Depends(_current_user_optional)):
    """Weak openers found in the resume + stronger verb alternatives."""
    _require_feature(db, "ai_review_enabled", "Action verbs")
    _enforce_ai_quota(db, user, "action-verbs")
    try:
        return ai_tools.suggest_action_verbs(payload.resume)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Action-verb scan failed: {exc}")


@router.post("/industry-keywords", response_model=schemas.AIIndustryKeywordsResponse)
def industry_keywords_route(payload: schemas.AISuggestSkillsRequest, db: Session = Depends(get_db),
                            user: Optional[models.User] = Depends(_current_user_optional)):
    """Role/industry-specific keyword bank inferred from the resume."""
    _require_feature(db, "ai_review_enabled", "Industry keywords")
    _enforce_ai_quota(db, user, "industry-keywords")
    try:
        return ai_tools.industry_keywords(payload.resume)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Industry keywords failed: {exc}")
