"""
ai_tools.py
-------------------------------------------------------------------------
AI TOOLS from the ResumeForge spec, layered on top of ai_service.py:

- analyze_keywords(resume, job_description)  -> matched/missing keywords + match %
- check_links(resume)                        -> portfolio/LinkedIn/GitHub review
                                               (presence, length, duplicates —
                                               NEVER claims a link "works")
- suggest_action_verbs(resume)               -> weak openers + stronger verbs
- industry_keywords(resume)                  -> role-specific keyword bank

Each real-AI path uses the same provider plumbing as ai_service; each has a
deterministic offline mock so everything works without an API key.
-------------------------------------------------------------------------
"""

import re
from typing import Any, Dict, List

from .ai_service import (
    _get_client,
    _call_model,
    _extract_json,
    _all_resume_text,
    _infer_role_bucket,
    ROLE_KEYWORDS,
)

_TECH_TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z0-9+#.]{1,30}")
_WEAK_OPENERS = [
    "responsible for", "helped with", "worked on", "duties included",
    "was tasked with", "tasked with", "assisted with", "participated in",
    "involved in", "in charge of",
]
_STRONG_VERBS = {
    "generic": ["Led", "Delivered", "Built", "Drove", "Owned", "Streamlined", "Launched"],
    "engineer": ["Architected", "Built", "Shipped", "Automated", "Optimized", "Migrated"],
    "designer": ["Designed", "Prototyped", "Redesigned", "Crafted"],
    "manager": ["Directed", "Scoped", "Prioritized", "Aligned", "Roadmapped"],
    "marketing": ["Grew", "Launched", "Positioned", "Scaled", "Optimized"],
    "sales": ["Closed", "Negotiated", "Exceeded", "Prospected", "Expanded"],
}
_UNPROFESSIONAL_HINTS = ("bit.ly", "tinyurl", "temp", "test-account")


def short_link_label(url: str) -> str:
    """Short display label per the spec: 'Portfolio: example.com', not a long URL."""
    u = (url or "").strip()
    u = re.sub(r"^https?://", "", u)
    u = re.sub(r"^www\.", "", u)
    u = u.rstrip("/")
    parts = u.split("/")
    if len(parts) > 2 and len(u) > 40:
        return "/".join(parts[:2]) + "/…"
    return u


def _dumps(obj: Any) -> str:
    import json
    return json.dumps(obj, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Job-description keyword analysis
# ---------------------------------------------------------------------------
KEYWORDS_SYSTEM_PROMPT = """You analyze how well a resume matches a pasted \
job description. Extract the genuinely important hard skills, tools, and \
domain keywords from the JOB DESCRIPTION (ignore filler and soft-skill \
cliches), then check which appear anywhere in the RESUME (case-insensitive). \
Never present a keyword as truth - for missing ones, note where it could \
NATURALLY be included IF the candidate actually has that experience.

Return ONLY valid JSON, no fences:
{"match_percent": <int 0-100>,
 "matched": ["<keyword>", ...],
 "missing": ["<keyword>", ...up to 8, ranked by importance],
 "notes": ["<one short sentence per top-3 missing keyword: where it could fit if true>"]}"""


def _mock_analyze_keywords(resume: Dict[str, Any], job_description: str) -> Dict[str, Any]:
    jd = (job_description or "").lower()
    if not jd.strip():
        return {"match_percent": 0, "matched": [], "missing": [],
                "notes": ["Paste a job description to analyze."]}
    bank = set()
    for kws in ROLE_KEYWORDS.values():
        bank.update(k.split("(")[0].strip() for k in kws)
    for tok in _TECH_TOKEN_RE.findall(job_description):
        tok = tok.rstrip(".")
        if len(tok) >= 3 and (tok[0].isupper() or "." in tok or "+" in tok):
            bank.add(tok)
    resume_text = _all_resume_text(resume).lower()
    matched, missing = [], []
    for kw in sorted(bank, key=len, reverse=True):
        k = kw.lower().strip()
        if len(k) < 3:
            continue
        if k in jd and k not in [m.lower() for m in matched] and k not in [m.lower() for m in missing]:
            (matched if k in resume_text else missing).append(kw)
    matched, missing = matched[:12], missing[:8]
    total = len(matched) + len(missing)
    match_percent = round(100 * len(matched) / total) if total else 0
    slots = ["the summary", "your most recent role's first bullet", "the skills section"]
    notes = [
        f"'{kw}' could fit naturally in {slots[i % len(slots)]} - add it ONLY if you truly have that experience."
        for i, kw in enumerate(missing[:3])
    ]
    return {
        "match_percent": match_percent,
        "matched": matched,
        "missing": missing,
        "notes": notes or ["No important keywords appear to be missing."],
    }


# ---------------------------------------------------------------------------
# Link review (format/presence only — never claims a link works)
# ---------------------------------------------------------------------------
def check_links(resume: Dict[str, Any]) -> Dict[str, Any]:
    pers = resume.get("personal") or {}
    links: List[Dict[str, Any]] = []
    issues: List[Dict[str, Any]] = []

    def _issue(field: str, label: str, issue: str, message: str):
        issues.append({"field": field, "label": label, "issue": issue, "message": message})

    entries = [
        ("personal.linkedin", "LinkedIn", pers.get("linkedin")),
        ("personal.website", "Portfolio", pers.get("website")),
        ("personal.github", "GitHub", pers.get("github")),
    ]
    seen_urls: Dict[str, str] = {}
    for field, label, url in entries:
        url = (url or "").strip()
        if not url:
            _issue(field, label, "missing",
                   f"No {label} link yet - recruiters expect at least LinkedIn.")
            continue
        display = short_link_label(url)
        links.append({"field": field, "label": label, "url": url, "display": display})
        if url.lower() in seen_urls:
            _issue(field, label, "duplicate",
                   f"Same URL already used for {seen_urls[url.lower()]} - remove the duplicate.")
        else:
            seen_urls[url.lower()] = label
        raw_len = len(url.replace("https://", "").replace("http://", ""))
        if raw_len > 60:
            _issue(field, label, "too_long",
                   "URL is very long - show a short label (e.g. just the domain) so the header stays uncluttered.")
        if any(h in url.lower() for h in _UNPROFESSIONAL_HINTS):
            _issue(field, label, "unprofessional_label",
                   "This looks like a shortened/test URL - use your real, professional link.")

    for i, proj in enumerate(resume.get("projects") or []):
        url = (proj.get("link") or "").strip()
        if url:
            links.append({"field": f"projects[{i}].link",
                          "label": f"Project: {proj.get('name') or i + 1}",
                          "url": url, "display": short_link_label(url)})
            if len(url.replace("https://", "")) > 60:
                _issue(f"projects[{i}].link", "Project link", "too_long",
                       "Project URL is long - prefer the repo root or a short demo domain.")

    for i, lk in enumerate(resume.get("links") or []):
        url = (lk.get("link") or lk.get("url") or "").strip()
        label = lk.get("label") or lk.get("name") or f"Link {i + 1}"
        if url:
            links.append({"field": f"links[{i}].link",
                          "label": label,
                          "url": url, "display": short_link_label(url)})
            if len(url.replace("https://", "")) > 60:
                _issue(f"links[{i}].link", label, "too_long",
                       "URL is long - prefer a concise domain or custom link label.")

    return {"links": links, "issues": issues}


def analyze_keywords(resume: Dict[str, Any], job_description: str) -> Dict[str, Any]:
    if not _get_client():
        return _mock_analyze_keywords(resume, job_description)
    user_content = {"resume": resume, "job_description": (job_description or "")[:6000]}
    try:
        raw = _call_model(KEYWORDS_SYSTEM_PROMPT, _dumps(user_content), max_tokens=700)
        return _extract_json(raw)
    except Exception:
        return _mock_analyze_keywords(resume, job_description)


# ---------------------------------------------------------------------------
# Action verbs
# ---------------------------------------------------------------------------
ACTION_VERBS_SYSTEM_PROMPT = """You review resume bullets for weak openings \
and passive framing. List every distinct weak opener actually used in the \
resume (e.g. "Responsible for", "Worked on"), then suggest stronger action \
verbs suited to the candidate's field and seniority. Do not rewrite their \
bullets - just supply verb alternatives they can apply themselves.

Return ONLY valid JSON, no fences:
{"current_weak": ["<weak opener found in the resume>", ...],
 "suggestions": ["<stronger verb>", ...8-12]}"""


def suggest_action_verbs(resume: Dict[str, Any]) -> Dict[str, Any]:
    if not _get_client():
        return _mock_action_verbs(resume)
    try:
        return _extract_json(_call_model(ACTION_VERBS_SYSTEM_PROMPT, _dumps(resume), max_tokens=400))
    except Exception:
        return _mock_action_verbs(resume)


def _mock_action_verbs(resume: Dict[str, Any]) -> Dict[str, Any]:
    text = _all_resume_text(resume).lower()
    current_weak = [w for w in _WEAK_OPENERS if w in text]
    bucket = _infer_role_bucket(resume, None) or ""
    suggestions = list(_STRONG_VERBS.get(bucket, [])) + _STRONG_VERBS["generic"]
    seen = set()
    suggestions = [v for v in suggestions if not (v in seen or seen.add(v))][:10]
    return {"current_weak": current_weak, "suggestions": suggestions}


# ---------------------------------------------------------------------------
# Industry keywords
# ---------------------------------------------------------------------------
INDUSTRY_KEYWORDS_SYSTEM_PROMPT = """Given a resume, infer the candidate's \
industry/field and list the specific keywords recruiters in THAT industry \
search for (tools, methodologies, certifications, domains). Rank by how much \
they matter for this candidate's level. Never claim the candidate has any of \
them.

Return ONLY valid JSON, no fences:
{"industry": "<inferred field>",
 "keywords": ["<keyword>", ...12-18]}"""


def industry_keywords(resume: Dict[str, Any]) -> Dict[str, Any]:
    if not _get_client():
        return _mock_industry_keywords(resume)
    try:
        return _extract_json(_call_model(INDUSTRY_KEYWORDS_SYSTEM_PROMPT, _dumps(resume), max_tokens=400))
    except Exception:
        return _mock_industry_keywords(resume)


def _mock_industry_keywords(resume: Dict[str, Any]) -> Dict[str, Any]:
    bucket = _infer_role_bucket(resume, None)
    if not bucket:
        generic = ["Cross-functional Collaboration", "Process Improvement", "Data Analysis",
                   "Stakeholder Management", "KPI Reporting"]
        return {"industry": None, "keywords": generic}
    return {"industry": bucket.title(), "keywords": list(ROLE_KEYWORDS[bucket])}