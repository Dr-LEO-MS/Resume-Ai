"""
schemas.py
-------------------------------------------------------------------------
Pydantic models used for request validation and response serialization.
`ResumeContent` intentionally uses a permissive dict-like shape (Dict[str,
Any] for nested content) since the frontend owns the canonical resume shape
in static/js/state.js — keeping the backend schema loose avoids the two
having to be updated in lockstep for every new field.
-------------------------------------------------------------------------
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ---- Auth ------------------------------------------------------------------
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=14)  # SEC-AUTH-006
    full_name: Optional[str] = ""


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class GoogleAuthRequest(BaseModel):
    credential: str  # the Google ID token (JWT) from the GIS button


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    full_name: Optional[str] = ""
    plan: Optional[str] = "free"
    role: Optional[str] = "user"
    plan_expires_at: Optional[str] = None


class UserOutExtended(UserOut):
    bio: Optional[str] = None
    profile_picture_url: Optional[str] = None
    profile_slug: Optional[str] = None
    is_profile_public: Optional[bool] = False
    timezone: Optional[str] = "UTC"
    date_format: Optional[str] = "MM/DD/YYYY"
    locale: Optional[str] = "en"
    notifications_email: Optional[bool] = True
    notifications_product: Optional[bool] = True
    created_at: Optional[datetime] = None
    has_google: Optional[bool] = False
    has_set_password: Optional[bool] = False
    last_login_at: Optional[datetime] = None
    last_login_ip: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: Optional[str] = None
    new_password: str = Field(min_length=14)


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    profile_slug: Optional[str] = None
    is_profile_public: Optional[bool] = None


class UpdateEmailRequest(BaseModel):
    new_email: EmailStr
    current_password: Optional[str] = None


class UpdatePreferencesRequest(BaseModel):
    timezone: Optional[str] = None
    date_format: Optional[str] = None
    locale: Optional[str] = None
    notifications_email: Optional[bool] = None
    notifications_product: Optional[bool] = None


class DeleteAccountRequest(BaseModel):
    current_password: Optional[str] = None
    confirmation: str


class UserUpdateAdmin(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    plan: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None
    # Pro subscription window. Send both to set a time-limited Pro plan;
    # omit plan_expires_at (or send null explicitly) for a plan that never expires.
    plan_started_at: Optional[str] = None  # ISO date, e.g. "2026-08-22"
    plan_expires_at: Optional[str] = None  # ISO date
    clear_expiry: bool = False  # explicit flag to null out an existing expiry date


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=14)  # SEC-AUTH-006


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---- Resume ------------------------------------------------------------------
class ResumeIn(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    template: str = "classic"
    doc_type: str = "resume"  # "resume" | "cover_letter"
    content: Dict[str, Any]  # matches the JS ResumeState shape


class ResumeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    template: str
    doc_type: str = "resume"
    content: Dict[str, Any]
    updated_at: str


# ---- AI generation & import --------------------------------------------------
class AIGenerateRequest(BaseModel):
    kind: str  # "summary" | "bullets" | "skills" | "cover_letter"
    job_title: str
    context: Optional[Dict[str, Any]] = None  # e.g. {"company": "...", "years": 3} for bullets / cover letters


class AIGenerateResponse(BaseModel):
    kind: str
    result: Any  # string for summary, list[str] for bullets/skills


class AISuggestSkillsRequest(BaseModel):
    resume: Dict[str, Any]


class AISuggestSkillsResponse(BaseModel):
    technical: List[str] = []
    tools: List[str] = []
    soft: List[str] = []


class ImportResumeResponse(BaseModel):
    resume: Dict[str, Any]
    warnings: List[str] = []


# ---- AI ------------------------------------------------------------------
class AICheckRequest(BaseModel):
    resume: Dict[str, Any]
    target_role: Optional[str] = None  # optional job title to tailor keyword matching
    job_description: Optional[str] = None  # optional pasted JD for keyword match


class Suggestion(BaseModel):
    id: str
    section: str
    type: str
    severity: str
    message: str
    original: Optional[str] = None
    suggested: Optional[str] = None
    entryId: Optional[str] = None
    bulletIndex: Optional[int] = None


class AICheckResponse(BaseModel):
    score: int
    subscores: Dict[str, int]
    suggestions: List[Suggestion]


class AIEnhanceRequest(BaseModel):
    resume: Dict[str, Any]


class AIEnhanceResponse(BaseModel):
    resume: Dict[str, Any]


class AIEnhanceTextRequest(BaseModel):
    text: str
    kind: str  # "bullet" | "summary"
    context: Optional[Dict[str, Any]] = None


class AIEnhanceTextResponse(BaseModel):
    original: str
    suggested: str


class AIChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class AIChatRequest(BaseModel):
    resume: Dict[str, Any]
    messages: List[AIChatMessage]  # recent user/assistant turns (no system turn)


class AIChatResponse(BaseModel):
    reply: str


# ---- AI tools (ResumeForge spec) ---------------------------------------------
class AIKeywordsRequest(BaseModel):
    resume: Dict[str, Any]
    job_description: str


class AIKeywordsResponse(BaseModel):
    match_percent: int
    matched: List[str] = []
    missing: List[str] = []
    notes: List[str] = []  # where/how a missing keyword could naturally fit


class AIActionVerbsResponse(BaseModel):
    current_weak: List[str] = []      # weak/passive openers found in the resume
    suggestions: List[str] = []       # stronger alternatives, context-matched


class AIIndustryKeywordsResponse(BaseModel):
    industry: Optional[str] = None
    keywords: List[str] = []


class AILinkIssue(BaseModel):
    field: str          # personal.linkedin | personal.website | personal.github | projects[n].link
    label: str          # human label, e.g. "LinkedIn"
    issue: str          # "missing" | "too_long" | "duplicate" | "unprofessional_label"
    message: str


class AILinksCheckResponse(BaseModel):
    links: List[Dict[str, Any]] = []  # [{field,label,url,display}]
    issues: List[AILinkIssue] = []
    # NOTE: presence/format review only — this does NOT verify a link actually works.


# ---- Export / contact --------------------------------------------------------
class ExportRequest(BaseModel):
    resume: Dict[str, Any]


class ShareLinkResponse(BaseModel):
    url: str


class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    message: str
