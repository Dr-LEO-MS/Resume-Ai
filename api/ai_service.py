"""
ai_service.py
-------------------------------------------------------------------------
All prompt engineering lives here, in one place, so the prompts can be
tuned without touching route logic. Uses the Anthropic Python SDK
(pip install anthropic) by default; swap `_call_model` to hit OpenAI,
DeepSeek, or another provider if you prefer — everything above that
function is provider-agnostic.

Environment variables:
  AI_PROVIDER          — "anthropic" (default), "openai", or "deepseek"
  ANTHROPIC_API_KEY    — required by the anthropic provider
  AI_MODEL             — Claude model id, defaults to "claude-sonnet-4-6"
  OPENAI_API_KEY       — required by the openai provider
  OPENAI_MODEL         — OpenAI model id, defaults to "gpt-4o-mini"
  DEEPSEEK_API_KEY     — required by the deepseek provider
  DEEPSEEK_MODEL       — DeepSeek model id, defaults to "deepseek-chat"

If the relevant API key is not set (or the SDK is missing), functions
fall back to a deterministic mock so the frontend is fully testable
without an API key.

Provider is selected via AI_PROVIDER. Everything above `_call_model` /
`_call_chat` is provider-agnostic, so switching providers is config, not
code.
-------------------------------------------------------------------------
"""

import json
import os
import re
from typing import Any, cast, Dict, List, Optional

# ---------------- Provider / model selection ---------------------------------
AI_PROVIDER = os.getenv("AI_PROVIDER", "anthropic").lower()
AI_MODEL = os.getenv("AI_MODEL", "claude-sonnet-4-6")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
# A single API key slot — whichever provider is active — drives the mock check.
API_KEY = os.getenv("ANTHROPIC_API_KEY") or os.getenv("OPENAI_API_KEY") or os.getenv("DEEPSEEK_API_KEY")
# A single key slot keeps the public mock checks working regardless of which
# provider is active. The SDK is imported LAZILY on first use (_get_client) so
# importing this module (and therefore app startup) stays fast even though the
# anthropic SDK takes a long time to import on some machines.
_client = None
_anthropic_client = None
_openai_client = None
_deepseek_client = None


def _get_client():
    """Lazily import + instantiate the configured provider SDK exactly once.
    Returns the client (truthy) or None if no API key / SDK is available, so
    callers can decide between real AI and the offline mock."""
    global _client, _anthropic_client, _openai_client, _deepseek_client
    if _client is not None:
        return _client
    if not API_KEY:
        return None
    if AI_PROVIDER == "openai":
        try:
            import openai
            _openai_client = openai.OpenAI(api_key=API_KEY, timeout=30.0, max_retries=3)
        except Exception:
            _openai_client = None
        _client = _openai_client
    elif AI_PROVIDER == "deepseek":
        try:
            import openai
            _deepseek_client = openai.OpenAI(
                api_key=os.getenv("DEEPSEEK_API_KEY", API_KEY),
                base_url="https://api.deepseek.com/v1",
                timeout=30.0,
                max_retries=3
            )
        except Exception:
            _deepseek_client = None
        _client = _deepseek_client
    else:
        try:
            import anthropic
            _anthropic_client = anthropic.Anthropic(api_key=API_KEY)
        except Exception:
            _anthropic_client = None
        _client = _anthropic_client
    return _client

# ---------------------------------------------------------------------------
# PROMPTS
# ---------------------------------------------------------------------------
# These are the exact system prompts used for the "AI Review" and "AI Enhance"
# features. Copy/adapt them if you're wiring this up to your own agent runner
# instead of calling _call_model() below.

CHECK_SYSTEM_PROMPT = """You are a senior resume reviewer with three combined \
areas of expertise, and you review every resume wearing all three hats at once:

1. A Fortune-500 technical recruiter with 15+ years screening resumes for \
   the candidate's apparent field — you know exactly what makes a hiring \
   manager stop skimming and start reading.
2. An ATS (Applicant Tracking System) parsing specialist who has reverse- \
   engineered how Workday, Greenhouse, Taleo, and iCIMS extract and rank \
   structured resume data.
3. A career coach who tells the truth about what's weak, kindly but plainly, \
   because a resume that "feels fine" to its author but reads as generic to \
   a recruiter is a failure mode you exist to catch.

You are given a resume as JSON, and optionally a `target_role` (the job \
title/field the candidate is applying for). If `target_role` is given, judge \
the resume specifically against what a hiring manager for THAT role expects \
— seniority-appropriate language, role-specific keywords, and the kind of \
impact metrics that role cares about (an SRE's resume should show uptime/ \
incident metrics; a sales resume should show quota/revenue numbers; a \
designer's resume should show the scale and outcome of what they shipped). \
If no target_role is given, infer the candidate's field from their most \
recent title, summary, and skills, and hold them to that field's standard.

Evaluate along six dimensions (the ATS subscore contract, in this priority \
order — most hiring-impact first):

1. EXPERIENCE RELEVANCE & QUANTIFICATION — the single biggest lever on a resume. Every \
    experience bullet should read as an ACHIEVEMENT (what changed because of \
    this person) not a RESPONSIBILITY (what they were assigned to do). Flag \
    every bullet that describes a duty instead of an outcome, and every \
    bullet missing a metric (%, $, time saved, scale, team size, before/after) \
    where one plausibly exists. Weak openers ("Responsible for", "Helped \
    with", "Worked on") and passive voice belong here too — they read as junior.
2. KEYWORD MATCH — compare the resume's skills/summary/experience language \
    against what real job postings for this role/field typically require. Flag \
    specific, named gaps (not vague "add more keywords" — name the actual \
    missing terms) and reward resumes that already cover them well. If a \
    `job_description` is provided, match against ITS exact wording instead.
3. SKILLS MATCH — required vs technical skills present, duplicate skills, \
    generic filler ("Communication, Teamwork") with nothing role-specific, and \
    relevant skills the candidate plausibly has but hasn't listed.
4. COMPLETENESS — required sections present and populated: contact fields a \
    recruiter needs (email/phone/location), professional links (LinkedIn plus \
    portfolio/GitHub for technical roles), a summary, experience with dates \
    and bullets, education, skills. Missing sections cost more than thin ones.
5. READABILITY & CONSISTENCY — typos, verb tense drift (past roles need \
    past tense; the current role needs present tense; don't mix within one \
    entry), inconsistent date formats, redundant phrasing, bullets that ramble \
    past ~2 lines.
6. FORMATTING / ATS STRUCTURE RISK — an empty or missing summary, empty \
    sections, non-standard section ordering that hides the most relevant \
    content, or anything else that would trip a Workday/Greenhouse parser.

Return ONLY valid JSON (no markdown fences, no prose before or after) \
matching exactly this shape:

{
  "score": <int 0-100, overall — be honest, not encouraging; a generic but \
error-free resume should score 55-70, not 85+>,
  "subscores": {"completeness": <int>, "keyword_match": <int>, "skills_match": <int>, "experience_relevance": <int>, "formatting": <int>, "readability": <int>},
  "suggestions": [
    {
      "id": "<short unique id>",
      "section": "summary" | "experience" | "education" | "skills" | "projects",
      "type": "weak_verb" | "grammar" | "keyword_gap" | "quantify" | "ats_format" | "seniority_mismatch",
      "severity": "high" | "medium" | "low",
      "message": "<one sentence, specific, names the exact problem and why a recruiter would notice it — never generic advice>",
      "original": "<exact original text, or null if the issue has no single text span (e.g. missing keyword)>",
      "suggested": "<rewritten text if applicable, or null>",
      "entryId": "<id of the experience entry this bullet belongs to, if section is experience>",
      "bulletIndex": <index of the bullet within that entry's bullets array, if applicable>
    }
  ]
}

Non-negotiable rules:
- Give 6-14 suggestions, ranked by hiring impact, not every possible nitpick. \
  A resume with real problems should get mostly "high" severity items; don't \
  pad the list with trivial "low" items to hit a count.
- NEVER invent facts, employers, numbers, dates, or achievements the \
  candidate did not provide. If a bullet lacks a metric, flag it and suggest \
  ADDING a bracketed placeholder like "[quantify: e.g. % improvement or team \
  size]" — never fabricate a plausible-sounding number.
- Keep "message" under 28 words and make every word earn its place — say \
  what's wrong AND why it matters to a hiring decision, not just "this is weak."
- Be specific about keyword gaps: name the actual terms missing (e.g. \
  "\\"CI/CD\\" and \\"Kubernetes\\" appear in most senior DevOps postings but \
  not on this resume"), never a vague "add more industry keywords."
- If the resume is genuinely strong in an area, don't manufacture a complaint \
  — a resume can legitimately score well on some subscores and poorly on \
  others."""


ENHANCE_SYSTEM_PROMPT = """You are an expert resume writer — the person \
hiring managers wish had written every resume they screen. You are given a \
full resume as JSON and rewrite it to be measurably stronger while \
preserving every fact exactly as given. You never invent employers, dates, \
numbers, titles, or achievements that weren't already present or clearly \
implied.

For each bullet in "experience":
- Open with a strong, specific action verb matched to seniority (an IC uses \
  "Built/Implemented/Designed"; a lead uses "Led/Directed/Drove"; avoid \
  generic verbs like "Did" or "Made").
- Reframe duty-statements as achievement-statements: shift from "what I was \
  assigned" to "what changed because I did it," using only facts already in \
  the original text.
- Preserve every real metric exactly (never round, invent, or exaggerate a \
  number). If no metric exists in the original, do NOT add one — tighten the \
  language and strengthen the verb instead of fabricating impact.
- Cut filler words ("various", "successfully", "responsible for", "in order \
  to") and redundant phrasing.
- Keep each bullet under ~220 characters and to a single line of thought — \
  split a bullet doing two unrelated things into sharper, separate ideas \
  only if both fit naturally; otherwise keep it as one bullet.

For "summary": rewrite as 2-3 sentences that lead with the candidate's \
strongest, most specific, most differentiating qualification for their \
apparent field — not a generic "hardworking team player" opener. Every \
sentence should contain information a recruiter can't get from the job \
title alone.

Do not change: personal info, dates, company/school names, skills list \
values, education, or the overall JSON structure/keys.

Return ONLY the complete resume as valid JSON, in exactly the same shape you \
were given (same keys, same nesting), with only the text fields improved. No \
markdown fences, no commentary, no explanation of what you changed."""


ENHANCE_TEXT_SYSTEM_PROMPT = """You rewrite ONE resume field to be \
measurably stronger, without ever inventing facts. You are given `kind` \
(what field this is) and `text` (the current content), plus optional \
`context` (e.g. the person's job title, or the resume section it belongs to) \
to calibrate tone and seniority. Apply the rule set for the given `kind`:

- "bullet" (an experience bullet point): open with a strong, seniority- \
  appropriate action verb; reframe as an achievement, not a duty; preserve \
  any existing metric exactly; never add a metric that wasn't there; cut \
  filler words; stay under ~220 characters.
- "summary" (professional summary): return a tightened 2-3 sentence summary \
  leading with the candidate's most specific, differentiating qualification \
  — never a generic "results-driven professional" opener.
- "title" (a job title or headline): return a clean, standard-casing, \
  industry-recognizable version of the given title — fix typos/casing, \
  don't invent a different title or seniority level than implied.
- "project_description": tighten to one or two sentences that lead with \
  what was built and its outcome/scale, in the same voice as a strong resume \
  bullet — cut narrative filler.
- "certification" or "skill_label": return a cleaned-up, correctly-cased, \
  industry-standard name for the given credential/skill (e.g. fix casing, \
  expand a known acronym only if the original already implied it) — never \
  substitute a different credential.
- "education_field" (degree/field of study, honors, or coursework line): \
  tighten wording and standardize formatting without changing the actual \
  degree, institution, or facts stated.
- "cover_letter": polish cover letter text for professional impact, strong \
  active tone, persuasive phrasing, and smooth paragraph transitions, keeping \
  length to 250-400 words (3-4 paragraphs).

For every kind: return ONLY the rewritten text itself — no quotes, no \
markdown, no explanation, no preamble. If the input is already strong and \
there is genuinely nothing to improve, return it unchanged rather than \
making a cosmetic edit just to seem useful."""


SUGGEST_SKILLS_SYSTEM_PROMPT = """You are an expert technical recruiter and resume strategist who knows \
exactly which skills real job postings require across industries.

Given the candidate's current resume (job titles, summary, experience, and existing \
skills), suggest relevant, high-impact skills they plausibly possess based on their work \
history and target role, but haven't explicitly listed yet.

You MUST provide balanced suggestions across ALL THREE categories:
1. "technical": 3 to 6 core technical competencies, domain specializations, programming languages, architectures, or methodologies.
2. "tools": 3 to 6 software tools, cloud platforms, developer utilities, frameworks, or SaaS applications relevant to their role.
3. "soft": 3 to 4 leadership, communication, agile practices, problem solving, or workplace competencies that recruiters screen for.

Return ONLY valid JSON, no markdown fences:
{
  "technical": ["<skill 1>", "<skill 2>", ...],
  "tools": ["<tool 1>", "<tool 2>", ...],
  "soft": ["<soft skill 1>", "<soft skill 2>", ...]
}

Never suggest a skill that wildly contradicts what their experience describes. \
Ensure all suggestions are ATS-friendly, professional, and directly complementary to their career profile."""


# ---------------------------------------------------------------------------
# MODEL CALL
# ---------------------------------------------------------------------------
def _call_model(system_prompt: str, user_content: str, max_tokens: int = 2000) -> str:
    """Sends one user message to the configured provider (see AI_PROVIDER)
    and returns the raw text response. Centralizing this makes provider
    swapping a config change, not a code change."""
    if not _get_client():
        raise RuntimeError(
            f"No API key is set for provider '{AI_PROVIDER}' — set "
            f"ANTHROPIC_API_KEY (anthropic), OPENAI_API_KEY (openai), or "
            f"DEEPSEEK_API_KEY (deepseek) in your environment to enable real "
            f"AI calls. See mock fallbacks in this file for offline testing."
        )
    if AI_PROVIDER == "openai":
        client = _openai_client
        if client is None:
            raise RuntimeError("OpenAI provider selected but the client failed to initialize.")
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            max_tokens=max_tokens,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
        )
        return (response.choices[0].message.content or "").strip()
    elif AI_PROVIDER == "deepseek":
        client = _deepseek_client
        if client is None:
            raise RuntimeError("DeepSeek provider selected but the client failed to initialize.")
        response = client.chat.completions.create(
            model=DEEPSEEK_MODEL,
            max_tokens=max_tokens,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
        )
        return (response.choices[0].message.content or "").strip()
    aclient = _anthropic_client
    if aclient is None:
        raise RuntimeError("Anthropic provider selected but the client failed to initialize.")
    response = aclient.messages.create(
        model=AI_MODEL,
        max_tokens=max_tokens,
        system=system_prompt,
        messages=[{"role": "user", "content": user_content}],
    )
    return "".join(block.text for block in response.content if block.type == "text")


def _call_chat(system_prompt: str, messages: List[Dict[str, str]], max_tokens: int = 2000) -> str:
    """Multi-turn conversation helper for the resume assistant. `messages` is a
    list of {"role": "user"|"assistant", "content": "..."} turns (no leading
    system turn — that is passed separately and injected by the adapter)."""
    if not _get_client():
        raise RuntimeError("No API key is set — see _call_model for details.")
    if AI_PROVIDER == "openai":
        client = _openai_client
        if client is None:
            raise RuntimeError("OpenAI provider selected but the client failed to initialize.")
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            max_tokens=max_tokens,
            messages=[{"role": "system", "content": system_prompt}, *messages],
        )
        return (response.choices[0].message.content or "").strip()
    elif AI_PROVIDER == "deepseek":
        client = _deepseek_client
        if client is None:
            raise RuntimeError("DeepSeek provider selected but the client failed to initialize.")
        response = client.chat.completions.create(
            model=DEEPSEEK_MODEL,
            max_tokens=max_tokens,
            messages=[{"role": "system", "content": system_prompt}, *messages],
        )
        return (response.choices[0].message.content or "").strip()
    aclient = _anthropic_client
    if aclient is None:
        raise RuntimeError("Anthropic provider selected but the client failed to initialize.")
    anthropic_messages = [
        {"role": "assistant" if m.get("role") == "assistant" else "user", "content": m["content"]}
        for m in messages
    ]
    response = aclient.messages.create(
        model=AI_MODEL,
        max_tokens=max_tokens,
        system=system_prompt,
        messages=cast(Any, anthropic_messages),  # dict shape matches MessageParam at runtime
    )
    return "".join(block.text for block in response.content if block.type == "text").strip()


def _extract_json(raw: str) -> Dict[str, Any]:
    """Models occasionally wrap JSON in markdown fences despite instructions
    not to — strip those defensively before parsing."""
    cleaned = re.sub(r"^```(json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
    return json.loads(cleaned)


# ---------------------------------------------------------------------------
# PUBLIC FUNCTIONS (called by api/routers/ai.py)
# ---------------------------------------------------------------------------
def check_resume(resume: Dict[str, Any], target_role: Optional[str] = None,
                 job_description: Optional[str] = None) -> Dict[str, Any]:
    if not _get_client():
        return _mock_check(resume, target_role, job_description)
    user_content = json.dumps({
        "resume": resume,
        "target_role": target_role,
        "job_description": (job_description or "")[:6000] or None,
    })
    try:
        raw = _call_model(CHECK_SYSTEM_PROMPT, user_content)
        return _extract_json(raw)
    except Exception:
        return _mock_check(resume, target_role, job_description)


def enhance_resume(resume: Dict[str, Any]) -> Dict[str, Any]:
    if not _get_client():
        return _mock_enhance_resume(resume)
    try:
        raw = _call_model(ENHANCE_SYSTEM_PROMPT, json.dumps(resume), max_tokens=4000)
        return _extract_json(raw)
    except Exception:
        return _mock_enhance_resume(resume)


def enhance_text(text: str, kind: str, context: Optional[Dict[str, Any]] = None) -> str:
    if not _get_client():
        return _mock_enhance_text(text, kind)
    user_content = json.dumps({"text": text, "kind": kind, "context": context or {}})
    try:
        raw = _call_model(ENHANCE_TEXT_SYSTEM_PROMPT, user_content, max_tokens=300)
        return raw.strip().strip('"')
    except Exception:
        return _mock_enhance_text(text, kind)


def suggest_skills(resume: Dict[str, Any]) -> Dict[str, Any]:
    """Suggests additional skills the candidate plausibly has but hasn't
    listed, based on their actual job titles/experience — used by the
    'AI suggest' button in the Skills section of the builder."""
    if not _get_client():
        return _mock_suggest_skills(resume)
    try:
        raw = _call_model(SUGGEST_SKILLS_SYSTEM_PROMPT, json.dumps(resume), max_tokens=500)
        return _extract_json(raw)
    except Exception:
        return _mock_suggest_skills(resume)


# ---------------------------------------------------------------------------
# AI RESUME ASSISTANT (multi-turn chat — the "AI Assistant" modal in the
# builder). Grounded in the live resume so the assistant talks about the
# user's actual content, not generic advice.
# ---------------------------------------------------------------------------
CHAT_SYSTEM_PROMPT = """You are an experienced resume coach embedded inside a \
resume builder. The user is chatting with you to improve the resume you can \
see (provided as JSON). Be friendly, concrete, and honest — never flatter. \
Ground every answer in THEIR actual resume content, not generic tips. When \
they ask you to rewrite a section or bullet, give a ready-to-paste \
replacement. When they mention a target role, tailor keyword and ATS guidance \
to that role. Keep answers concise; use short markdown bullets only when they \
help. Don't restate the whole resume back — reference only the parts relevant \
to their question."""


def chat_with_resume(messages: List[Dict[str, str]], resume: Dict[str, Any]) -> str:
    """Answers a multi-turn, resume-grounded chat. `messages` is the recent
    user/assistant history; the current resume is injected as grounding."""
    if not _get_client():
        return _mock_chat(messages, resume)
    grounded = [
        {
            "role": "user",
            "content": "Here is my current resume as JSON — use it to answer my questions:"
            + json.dumps(resume, ensure_ascii=False)[:12000],
        },
        *messages,
    ]
    try:
        return _call_chat(CHAT_SYSTEM_PROMPT, grounded, max_tokens=800)
    except Exception:
        return _mock_chat(messages, resume)


# ---------------------------------------------------------------------------
# OFFLINE MOCKS (used automatically when ANTHROPIC_API_KEY is unset, so the
# frontend and API contract are fully testable — and genuinely useful, not
# just a placeholder — without an API key). Real power comes from the live
# model above; this is a deliberately-built heuristic engine covering the
# same five dimensions the CHECK_SYSTEM_PROMPT evaluates, not a toy.
# ---------------------------------------------------------------------------
WEAK_VERBS = ("responsible for", "helped with", "worked on", "in charge of", "assisted with", "duties included", "was tasked with")
STRONG_REPLACEMENTS = {
    "responsible for": "led",
    "helped with": "contributed to",
    "worked on": "built",
    "in charge of": "directed",
    "assisted with": "supported",
    "duties included": "delivered",
    "was tasked with": "owned",
}

# Matches any weak phrase ANYWHERE in the text (not just at the start), so
# "I was responsible for the migration" gets caught just as much as
# "Responsible for the migration". Longest phrases first so "in charge of"
# doesn't get partially shadowed by a shorter overlapping match.
_WEAK_VERB_PATTERN = re.compile(
    # Optional leading subject/auxiliary ("I was", "I am", "Was", "Is") is
    # captured and dropped along with the weak phrase itself, so "Was
    # responsible for X" becomes "Led X" — not the grammatically broken
    # "Was led X" that resulted from replacing only the inner phrase.
    r"\b(?:i\s+)?(?:was|is|am|were)?\s*\b("
    + "|".join(re.escape(w) for w in sorted(WEAK_VERBS, key=len, reverse=True))
    + r")\b",
    re.IGNORECASE,
)
_PASSIVE_PATTERN = re.compile(r"\b(was|were|is|are|been)\s+\w+ed\b", re.IGNORECASE)

# A small, deliberately curated keyword bank per common field — used to
# generate *specific* keyword-gap suggestions instead of vague "add more
# keywords" advice. Matched against the role inferred from the candidate's
# most recent title (or an explicit target_role), case-insensitively, as
# whole words against the resume's combined text.
ROLE_KEYWORDS = {
    "software engineer": ["Git", "CI/CD", "REST API", "Unit Testing", "Agile", "System Design", "Cloud (AWS/GCP/Azure)", "Docker"],
    "data scientist": ["Python", "SQL", "Machine Learning", "A/B Testing", "Pandas", "Data Visualization", "Statistical Modeling"],
    "data analyst": ["SQL", "Excel", "Data Visualization", "Tableau/Power BI", "Statistical Analysis", "ETL"],
    "product manager": ["Roadmap", "Stakeholder Management", "A/B Testing", "User Research", "Agile/Scrum", "KPIs", "Prioritization"],
    "designer": ["Figma", "User Research", "Prototyping", "Design Systems", "Accessibility", "Usability Testing"],
    "marketing": ["SEO", "Campaign Management", "Analytics", "A/B Testing", "Content Strategy", "CRM"],
    "sales": ["Quota Attainment", "Pipeline Management", "CRM (Salesforce)", "Negotiation", "Prospecting", "Revenue Growth"],
    "devops": ["CI/CD", "Kubernetes", "Terraform", "Infrastructure as Code", "Monitoring/Observability", "Cloud (AWS/GCP/Azure)"],
    "project manager": ["Stakeholder Management", "Risk Management", "Budget Management", "Agile/Scrum", "Cross-functional Leadership"],
    "finance": ["Financial Modeling", "Variance Analysis", "Forecasting", "GAAP/IFRS", "Cash Flow Analysis"],
    "human resources": ["Talent Acquisition", "Onboarding", "HR Compliance", "Performance Management", "Employee Relations"],
}

ROLE_SUGGESTED_SKILLS: Dict[str, Dict[str, List[str]]] = {
    "software engineer": {
        "technical": ["REST API Design", "Microservices", "System Architecture", "Unit & Integration Testing", "Data Structures", "Database Optimization", "GraphQL"],
        "tools": ["Git & GitHub", "Docker", "CI/CD Pipelines", "AWS / Cloud", "PostgreSQL", "Redis", "Linux", "Kubernetes"],
        "soft": ["Agile / Scrum", "Code Review", "Cross-functional Collaboration", "Technical Mentorship", "Problem Solving"],
    },
    "data scientist": {
        "technical": ["Machine Learning", "Statistical Modeling", "A/B Testing", "Deep Learning", "Data Mining", "Feature Engineering", "NLP"],
        "tools": ["Python", "SQL", "Pandas & NumPy", "Scikit-Learn", "PyTorch / TensorFlow", "Jupyter", "Tableau"],
        "soft": ["Data Storytelling", "Stakeholder Communication", "Research & Experimentation", "Analytical Thinking", "Cross-functional Alignment"],
    },
    "data analyst": {
        "technical": ["Data Modeling", "ETL Pipelines", "Statistical Analysis", "Business Intelligence", "Query Optimization", "Cohort Analysis"],
        "tools": ["SQL", "Tableau", "Power BI", "Excel (Advanced / VBA)", "dbt", "Snowflake", "Google BigQuery"],
        "soft": ["Stakeholder Reporting", "Requirements Gathering", "Data Storytelling", "Critical Thinking", "Problem Solving"],
    },
    "product manager": {
        "technical": ["Product Strategy", "Market Analysis", "User Story Mapping", "A/B Testing", "Metrics & KPIs", "Feature Prioritization", "Competitive Analysis"],
        "tools": ["Jira", "Figma", "Mixpanel", "Amplitude", "Confluence", "Notion", "Linear"],
        "soft": ["Stakeholder Management", "Cross-functional Leadership", "Customer Empathy", "Strategic Communication", "Negotiation"],
    },
    "designer": {
        "technical": ["UI/UX Design", "Design Systems", "Wireframing", "User Research", "Information Architecture", "Accessibility (WCAG)", "Interaction Design"],
        "tools": ["Figma", "Adobe Creative Suite", "ProtoPie", "Sketch", "Storybook", "Miro", "Zeplin"],
        "soft": ["Design Critique", "User Empathy", "Collaborative Problem Solving", "Visual Storytelling", "Stakeholder Presentation"],
    },
    "devops": {
        "technical": ["Infrastructure as Code", "CI/CD Automation", "Container Orchestration", "Site Reliability Engineering", "Observability", "Network Security", "Cloud Architecture"],
        "tools": ["Kubernetes", "Docker", "Terraform", "AWS / GCP / Azure", "Prometheus & Grafana", "GitHub Actions", "Ansible"],
        "soft": ["Incident Management", "Root Cause Analysis", "DevOps Culture Evangelism", "Cross-Team Collaboration", "Post-Mortem Facilitation"],
    },
    "project manager": {
        "technical": ["Sprint Planning", "Risk Management", "Budget Tracking", "Scope Management", "Process Optimization", "Resource Allocation", "Milestone Tracking"],
        "tools": ["Jira", "Asana", "Trello", "Smartsheet", "MS Project", "Slack", "ClickUp"],
        "soft": ["Agile Leadership", "Cross-Team Coordination", "Conflict Resolution", "Vendor Management", "Clear Communication"],
    },
    "marketing": {
        "technical": ["Search Engine Optimization (SEO)", "Conversion Rate Optimization (CRO)", "Email Marketing", "Content Strategy", "Performance Marketing", "Paid Acquisition"],
        "tools": ["Google Analytics 4", "HubSpot", "Google Ads", "SEMrush", "Mailchimp", "Meta Ads Manager", "Ahrefs"],
        "soft": ["Creative Problem Solving", "Brand Storytelling", "Audience Engagement", "Cross-functional Alignment", "Campaign Planning"],
    },
    "sales": {
        "technical": ["Sales Pipeline Management", "B2B Sales Strategy", "Contract Negotiation", "Lead Qualification", "Account Planning", "Revenue Forecasting", "Territory Management"],
        "tools": ["Salesforce", "HubSpot CRM", "Outreach.io", "LinkedIn Sales Navigator", "ZoomInfo", "Gong"],
        "soft": ["Relationship Building", "Active Listening", "Persuasive Presentation", "Resilience & Tenacity", "Customer Consultation"],
    },
    "finance": {
        "technical": ["Financial Modeling", "Variance Analysis", "Forecasting & Budgeting", "GAAP/IFRS Compliance", "Cash Flow Analysis", "Financial Reporting"],
        "tools": ["Excel (Advanced)", "QuickBooks", "NetSuite", "SAP ERP", "Bloomberg Terminal", "Power BI"],
        "soft": ["Financial Acumen", "Attention to Detail", "Executive Presentation", "Risk Assessment", "Strategic Thinking"],
    },
    "human resources": {
        "technical": ["Talent Acquisition", "Onboarding Programs", "HR Compliance & Labor Law", "Performance Management", "Compensation & Benefits", "Employee Retention"],
        "tools": ["Workday", "Greenhouse", "Lever", "BambooHR", "LinkedIn Recruiter", "Culture Amp"],
        "soft": ["Employee Relations", "Empathetic Communication", "Confidentiality & Ethics", "Conflict De-escalation", "Organizational Development"],
    },
    "general": {
        "technical": ["Project Planning", "Data Analysis", "Process Improvement", "Strategic Planning", "Quality Assurance", "Workflow Automation"],
        "tools": ["Microsoft 365 / Google Workspace", "Slack / Teams", "Trello / Notion", "Zoom", "Canva"],
        "soft": ["Effective Communication", "Time Management", "Problem Solving", "Adaptability", "Team Collaboration", "Critical Thinking"],
    },
}


def _infer_role_bucket(resume: Dict[str, Any], target_role: Optional[str]) -> Optional[str]:
    haystack = " ".join(filter(None, [
        target_role,
        (resume.get("personal") or {}).get("title"),
        resume.get("summary"),
        " ".join(e.get("role", "") for e in resume.get("experience", []) or []),
    ])).lower()
    for bucket in ROLE_KEYWORDS:
        if bucket in haystack or bucket.replace(" ", "") in haystack.replace(" ", ""):
            return bucket
    # Loose single-word fallbacks for common abbreviations/aliases
    aliases = {
        "swe": "software engineer", "developer": "software engineer", "engineer": "software engineer",
        "frontend": "software engineer", "backend": "software engineer", "fullstack": "software engineer",
        "full stack": "software engineer", "sre": "devops", "pm": "product manager",
        "ux": "designer", "ui": "designer", "graphic": "designer",
        "scrum": "project manager", "agile": "project manager",
        "hr": "human resources", "recruiter": "human resources",
        "finance": "finance", "financial": "finance", "accounting": "finance", "accountant": "finance",
    }
    for alias, bucket in aliases.items():
        if re.search(rf"\b{alias}\b", haystack):
            return bucket
    return None


def _all_resume_text(resume: Dict[str, Any]) -> str:
    parts = [resume.get("summary", "")]
    for e in resume.get("experience", []) or []:
        parts.append(e.get("role", ""))
        parts.extend(e.get("bullets", []) or [])
    skills = resume.get("skills")
    if isinstance(skills, dict):
        for v in skills.values():
            parts.extend(v or [])
    elif isinstance(skills, list):
        parts.extend(skills)
    return " ".join(p for p in parts if p).lower()


def _replace_weak_verbs(text: str) -> str:
    """Rewrites every weak phrase found anywhere in `text`, preserving
    sentence-start capitalization. Returns the text unchanged if no weak
    phrase is present (callers should apply their own light-touch cleanup
    on top for the "no weak phrase" case — see _mock_enhance_text)."""

    def _sub(match: re.Match) -> str:
        # group(1) is the weak phrase itself (dict key); group(0) is the full
        # match including any leading "I was"/"Was"/etc, which we intentionally
        # drop entirely rather than leave a dangling auxiliary verb behind.
        original = match.group(1)
        replacement = STRONG_REPLACEMENTS[original.lower()]
        # Capitalize the replacement if it's opening the sentence (start of
        # string, or right after ". "/"! "/"? "), else keep it lowercase.
        start = match.start()
        prior = text[:start].rstrip()
        sentence_start = start == 0 or (prior and prior[-1] in ".!?")
        return replacement.capitalize() if sentence_start else replacement

    return _WEAK_VERB_PATTERN.sub(_sub, text)


def _light_touch_cleanup(text: str) -> str:
    """Applied even when no weak phrase is found, so 'Enhance' visibly does
    something on already-decent input too: collapses stray whitespace,
    capitalizes the first letter, and adds terminal punctuation if missing.
    Never invents or removes factual content."""
    cleaned = re.sub(r"\s+", " ", text).strip()
    if not cleaned:
        return cleaned
    if cleaned[0].islower():
        cleaned = cleaned[0].upper() + cleaned[1:]
    if cleaned[-1] not in ".!?":
        cleaned += "."
    return cleaned


def _mock_check(resume: Dict[str, Any], target_role: Optional[str] = None,
                job_description: Optional[str] = None) -> Dict[str, Any]:
    suggestions = []
    for entry in resume.get("experience", []):
        for i, bullet in enumerate(entry.get("bullets", [])):
            if not bullet:
                continue
            if _WEAK_VERB_PATTERN.search(bullet):
                suggestions.append({
                    "id": f"exp-{entry.get('id')}-{i}-weak",
                    "section": "experience", "type": "weak_verb", "severity": "high",
                    "message": "This bullet opens with a weak/passive phrase instead of a strong action verb — reads as junior to a recruiter.",
                    "original": bullet, "suggested": _replace_weak_verbs(bullet),
                    "entryId": entry.get("id"), "bulletIndex": i,
                })
            elif _PASSIVE_PATTERN.search(bullet):
                suggestions.append({
                    "id": f"exp-{entry.get('id')}-{i}-passive",
                    "section": "experience", "type": "weak_verb", "severity": "medium",
                    "message": "Passive voice here buries who did the work — lead with an active verb instead.",
                    "original": bullet, "suggested": None,
                    "entryId": entry.get("id"), "bulletIndex": i,
                })
            if not re.search(r"\d", bullet):
                suggestions.append({
                    "id": f"exp-{entry.get('id')}-{i}-metric",
                    "section": "experience", "type": "quantify", "severity": "high",
                    "message": "No metric here — this reads as a duty, not an achievement. Add a number, %, or scale.",
                    "original": bullet,
                    "suggested": bullet.rstrip(".") + " [quantify: e.g. % improvement, team size, or scale]",
                    "entryId": entry.get("id"), "bulletIndex": i,
                })
            elif len(bullet) > 220:
                suggestions.append({
                    "id": f"exp-{entry.get('id')}-{i}-length",
                    "section": "experience", "type": "grammar", "severity": "low",
                    "message": "This bullet runs long — recruiters skim; tighten it to one clear idea.",
                    "original": bullet, "suggested": None,
                    "entryId": entry.get("id"), "bulletIndex": i,
                })

    if not resume.get("summary"):
        suggestions.append({
            "id": "summary-missing", "section": "summary", "type": "ats_format", "severity": "high",
            "message": "No summary — this is prime real estate a recruiter reads first; add 2-3 sentences on your top qualification.",
            "original": None, "suggested": None,
        })
    elif len(resume["summary"]) < 60:
        suggestions.append({
            "id": "summary-thin", "section": "summary", "type": "grammar", "severity": "medium",
            "message": "Summary is too short to differentiate you — expand to 2-3 sentences with a specific, concrete qualification.",
            "original": resume["summary"], "suggested": None,
        })

    # Keyword-gap analysis against a role-specific keyword bank — specific,
    # named gaps, not vague "add more keywords" advice.
    missing: List[str] = []
    role_bucket = _infer_role_bucket(resume, target_role)
    if role_bucket:
        resume_text = _all_resume_text(resume)
        missing = [kw for kw in ROLE_KEYWORDS[role_bucket] if kw.split("(")[0].strip().lower() not in resume_text][:4]
        if missing:
            suggestions.append({
                "id": "keyword-gap", "section": "skills", "type": "keyword_gap", "severity": "medium",
                "message": f"Common {role_bucket} keywords missing from this resume: {', '.join(missing)}.",
                "original": None, "suggested": None,
            })

    skills = resume.get("skills")
    skills_count = sum(len(v or []) for v in skills.values()) if isinstance(skills, dict) else len(skills or [])
    if skills_count < 3:
        suggestions.append({
            "id": "skills-sparse", "section": "skills", "type": "ats_format", "severity": "medium",
            "message": "Skills section is thin — ATS keyword matching relies heavily on this section; add more specific tools/technologies.",
            "original": None, "suggested": None,
        })

    score = max(30, 94 - sum(9 if x["severity"] == "high" else 5 if x["severity"] == "medium" else 2 for x in suggestions))
    # Spec-shaped ATS subscores (ResumeForge contract): completeness,
    # keyword_match, skills_match, experience_relevance, formatting, readability.
    pers = resume.get("personal") or {}
    contact_filled = sum(1 for v in ("fullName", "title", "email", "phone", "location") if str(pers.get(v) or "").strip())
    links_filled = sum(1 for v in ("linkedin", "website", "github") if str(pers.get(v) or "").strip())
    sections_present = sum(1 for k in ("summary", "experience", "education", "skills", "projects", "certifications") if resume.get(k))
    quantified = sum(1 for x in suggestions if x["type"] == "quantify")
    weak_verbs = sum(1 for x in suggestions if x["type"] == "weak_verb")
    grammar_issues = sum(1 for x in suggestions if x["type"] == "grammar")
    return {
        "score": score,
        "subscores": {
            "completeness": min(98, 30 + 11 * sections_present + 4 * contact_filled + (6 if links_filled else -8)),
            "keyword_match": max(20, 88 - (25 if role_bucket and missing else 10) - 3 * len(missing or [])) if role_bucket else max(25, score - 12),
            "skills_match": max(25, min(96, 40 + 8 * skills_count) - (12 if skills_count < 3 else 0)),
            "experience_relevance": max(25, 88 - 14 * quantified - 8 * weak_verbs),
            "formatting": max(30, 92 - (18 if not resume.get("summary") else 2) - 5 * sum(1 for k in ("summary", "experience", "education", "skills") if not resume.get(k))),
            "readability": max(25, 92 - 12 * grammar_issues - 6 * weak_verbs),
        },
        "suggestions": suggestions[:12],
    }


def _mock_enhance_resume(resume: Dict[str, Any]) -> Dict[str, Any]:
    for entry in resume.get("experience", []):
        entry["bullets"] = [_mock_enhance_text(b, "bullet") for b in entry.get("bullets", [])]
    if resume.get("summary"):
        resume["summary"] = _mock_enhance_text(resume["summary"], "summary")
    return resume


def _mock_enhance_text(text: str, kind: str) -> str:
    if not text or not text.strip():
        return text
    if kind in ("title", "certification", "skill_label"):
        # Standard title-casing cleanup — no weak-verb rewriting applies to labels.
        cleaned = re.sub(r"\s+", " ", text).strip()
        return " ".join(w if w.isupper() and len(w) <= 5 else w.capitalize() for w in cleaned.split(" "))
    rewritten = _replace_weak_verbs(text)
    return _light_touch_cleanup(rewritten)


def _mock_suggest_skills(resume: Dict[str, Any]) -> Dict[str, Any]:
    role_bucket = _infer_role_bucket(resume, None) or "general"
    skills_map = ROLE_SUGGESTED_SKILLS.get(role_bucket, ROLE_SUGGESTED_SKILLS.get("general", {}))

    existing = set()
    skills = resume.get("skills")
    if isinstance(skills, dict):
        for v in skills.values():
            if isinstance(v, list):
                existing.update(s.strip().lower() for s in v if isinstance(s, str))
    elif isinstance(skills, list):
        existing.update(s.strip().lower() for s in skills if isinstance(s, str))

    def filter_skills(skill_list: List[str], limit: int) -> List[str]:
        res = []
        for s in skill_list:
            clean = s.strip()
            if clean.lower() not in existing:
                res.append(clean)
                if len(res) >= limit:
                    break
        return res

    return {
        "technical": filter_skills(skills_map.get("technical", []), 6),
        "tools": filter_skills(skills_map.get("tools", []), 6),
        "soft": filter_skills(skills_map.get("soft", []), 4),
    }


# ---------------------------------------------------------------------------
# CONTENT GENERATION (summary / bullets / skills from a job title)
# ---------------------------------------------------------------------------
GENERATE_SYSTEM_PROMPT = """You write resume and cover letter content for a given job title. \
Given a "kind" ("summary", "bullets", "skills", or "cover_letter") and a job title (plus \
optional context like company name, hiring manager, experience highlights), generate \
compelling, realistic starter content. For cover letters, write a persuasive 3-4 paragraph \
letter (250-350 words) tailored to the role and company, following formal business etiquette. \
Use bracketed placeholders like "[X%]" or "[specific achievement]" for anything the candidate \
must personalize themselves.

Return ONLY valid JSON, no markdown fences:
- kind="summary": {"result": "<2-3 sentence professional summary string>"}
- kind="bullets": {"result": ["<bullet 1>", "<bullet 2>", "<bullet 3>", "<bullet 4>"]}
- kind="skills": {"result": ["<skill 1>", "<skill 2>", ... 8-12 skills typical for this role]}
- kind="cover_letter": {"result": "<3-4 paragraph formatted cover letter body>" }"""


def generate_content(kind: str, job_title: str, context: Optional[Dict[str, Any]] = None) -> Any:
    if not _get_client():
        return _mock_generate_content(kind, job_title, context)
    user_content = json.dumps({"kind": kind, "job_title": job_title, "context": context or {}})
    raw = _call_model(GENERATE_SYSTEM_PROMPT, user_content, max_tokens=1000)
    return _extract_json(raw).get("result")


def _mock_generate_content(kind: str, job_title: str, context: Optional[Dict[str, Any]] = None) -> Any:
    title = job_title.strip() or "professional"
    ctx = context or {}
    company = ctx.get("companyName") or ctx.get("company") or "your esteemed organization"
    manager = ctx.get("hiringManager") or "Hiring Team"
    if kind == "cover_letter":
        return (
            f"I am writing to express my enthusiastic interest in the {title} position at {company}. "
            f"With a proven track record of delivering impactful results and driving technical excellence, "
            f"I am confident that my background in strategic problem solving and team collaboration aligns "
            f"strongly with your team's objectives.\n\n"
            f"Throughout my career, I have specialized in designing scalable solutions and streamlining critical workflows. "
            f"In my previous roles, I successfully spearheaded key initiatives that improved operational performance by [X%] "
            f"and delivered robust outcomes under aggressive timelines. I take pride in translating complex business challenges "
            f"into reliable, high-value outcomes while mentoring colleagues and fostering a collaborative team culture.\n\n"
            f"{company}'s dedication to innovation and quality deeply resonates with me. I am excited about the opportunity "
            f"to contribute my expertise in [core skill area] and help accelerate your upcoming milestones.\n\n"
            f"Thank you for your time and consideration. I welcome the opportunity to discuss how my qualifications "
            f"and enthusiasm make me a strong match for {company}."
        )
    if kind == "summary":
        return (
            f"Results-driven {title} with [X years] of experience delivering measurable impact "
            f"through [core skill area]. Known for [key strength], with a track record of "
            f"[notable type of achievement — e.g. improving efficiency, driving growth]. "
            f"Seeking to bring [specific value] to a team focused on [target outcome]."
        )
    if kind == "bullets":
        return [
            f"Led [project/initiative] as {title}, resulting in [X%] improvement in [metric].",
            f"Collaborated with cross-functional teams to deliver [outcome], reducing [cost/time] by [X%].",
            f"Built and maintained [system/process], supporting [team size / scale] and improving [metric].",
            f"Presented [findings/results] to [stakeholders], informing decisions on [area].",
        ]
    if kind == "skills":
        generic = ["Communication", "Problem Solving", "Project Management", "Team Leadership"]
        role_specific = {
            "engineer": ["Python", "SQL", "Git", "System Design", "CI/CD", "Cloud (AWS/GCP/Azure)"],
            "designer": ["Figma", "User Research", "Prototyping", "Design Systems", "Accessibility"],
            "manager": ["Stakeholder Management", "Roadmapping", "Agile/Scrum", "Budgeting"],
            "marketing": ["SEO", "Content Strategy", "Analytics", "Campaign Management", "A/B Testing"],
            "sales": ["CRM (Salesforce)", "Pipeline Management", "Negotiation", "Prospecting"],
        }
        lower = title.lower()
        for key, skills in role_specific.items():
            if key in lower:
                return skills + generic
        return generic + ["Data Analysis", "Process Improvement"]
    return []


# ---------------------------------------------------------------------------
# RESUME IMPORT (raw text extracted from an uploaded PDF/DOCX -> structured JSON)
# ---------------------------------------------------------------------------
PARSE_SYSTEM_PROMPT = """You convert raw resume text (extracted from a PDF or \
Word document, so formatting/line breaks may be messy) into structured JSON \
matching EXACTLY this shape:

{
  "personal": {"fullName": "", "title": "", "email": "", "phone": "", "location": "", "linkedin": "", "github": "", "website": ""},
  "summary": "",
  "experience": [{"company": "", "role": "", "location": "", "start": "", "end": "", "current": false, "bullets": [""]}],
  "education": [{"school": "", "degree": "", "field": "", "start": "", "end": "", "gpa": ""}],
  "skills": {"technical": [], "tools": [], "soft": []},
  "projects": [{"name": "", "description": "", "link": ""}],
  "certifications": [{"name": "", "issuer": "", "date": ""}],
  "languages": [{"name": "", "level": ""}],
  "links": [{"label": "", "link": ""}]
}

Only include information that is actually present in the text — never invent \
employers, dates, or numbers. Leave fields as empty strings/arrays if not \
found. Return ONLY the JSON object, no markdown fences, no commentary."""


def parse_resume_text(raw_text: str) -> Dict[str, Any]:
    if not _get_client():
        return _mock_parse_resume_text(raw_text)
    raw = _call_model(PARSE_SYSTEM_PROMPT, raw_text[:12000], max_tokens=3000)
    return _extract_json(raw)


def _mock_parse_resume_text(raw_text: str) -> Dict[str, Any]:
    """Best-effort offline fallback: pulls out an email/phone with regex and
    dumps the rest into the summary so nothing the user uploaded is lost,
    even without an AI key configured."""
    email_match = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", raw_text)
    phone_match = re.search(r"(\+?\d[\d\s().-]{8,}\d)", raw_text)
    lines = [l.strip() for l in raw_text.splitlines() if l.strip()]
    full_name = lines[0] if lines else ""

    return {
        "personal": {
            "fullName": full_name[:80],
            "title": "",
            "email": email_match.group(0) if email_match else "",
            "phone": phone_match.group(0) if phone_match else "",
            "location": "",
            "linkedin": "",
            "github": "",
            "website": "",
        },
                "summary": (
            "AI parsing is running in offline mode (no AI API key set), so we "
            "couldn't auto-sort this into sections. Your original text is below — set "
            "ANTHROPIC_API_KEY, OPENAI_API_KEY, or DEEPSEEK_API_KEY for full "
            "automatic parsing.\n\n" + raw_text[:1500]
        ),
        "experience": [],
        "education": [],
        "skills": {"technical": [], "tools": [], "soft": []},
        "projects": [],
        "certifications": [],
        "languages": [],
        "links": [],
    }


def _mock_chat(messages: List[Dict[str, str]], resume: Dict[str, Any]) -> str:
    """Offline fallback for the AI Assistant. Uses the same heuristic keyword
    bank / resume text as the other mocks so the answers are specific to the
    candidate's actual content, not a generic 'set an API key' stub."""
    user_turns = [m for m in messages if m.get("role") == "user"]
    question = user_turns[-1]["content"].strip() if user_turns else ""
    q = question.lower()
    role_bucket = _infer_role_bucket(resume, None)
    resume_text = _all_resume_text(resume)

    if any(k in q for k in ("keyword", "ats", "tracker", "pars", "optimiz", "scan")):
        if role_bucket:
            missing = [
                kw for kw in ROLE_KEYWORDS[role_bucket]
                if kw.split("(")[0].strip().lower() not in resume_text
            ]
            if missing:
                return (
                    "To improve ATS fit for this field, consider truthfully weaving in "
                    "these role-specific keywords where they apply: "
                    + ", ".join(missing) + ". Mirror the exact phrasing of the job "
                    "description's required skills too."
                )
        return ("Make every bullet an outcome with a metric (%, $, scale), mirror the "
                "job description's exact required-skill phrasing, and keep a clean "
                "single-column layout with standard section headings so parsers read it correctly.")

    if any(k in q for k in ("quantif", "metric", "number", "impact", "strength", "achievement")):
        return ("Lead every bullet with the outcome: 'Led X, achieving [metric]' beats "
                "'Responsible for X'. Pick the single strongest number per role (revenue, "
                "scale, time saved) and put it at the front of your top bullet.")

    if any(k in q for k in ("summary", "profile", "headline", "rewrite", "write new")):
        summary = (resume.get("summary") or "").strip()
        if summary:
            return ("Your summary currently starts: " + summary[:120] + ". Tighten it to "
                    "2-3 sentences: open with your current title + top measurable strength, "
                    "mid-sentence name the domain, and close with the value you bring to the "
                    "target role.")
        return "Your summary is empty. Write 2-3 sentences: current title, top measurable strength, and the value you bring to the role you're targeting."

    if any(k in q for k in ("bullet", "weak verb", "strong verb", "stronger")):
        return ("Open bullets with strong action verbs (Led, Built, Delivered, Launched, "
                "Negotiated) and remove weak openings like 'Responsible for', 'Helped with', "
                "or 'Worked on'.")

    if any(k in q for k in ("length", "long", "one page", "space", "trim", "too long")):
        return ("Aim for one page unless it's 15+ years experience or academia. Cut bullets "
                "that just repeat skills already listed, keep the most recent role's bullets "
                "the most detailed, and tighten older entries to 2 bullets each.")

    if any(k in q for k in ("skill", "competenc", "tech stack", "stack")):
        if role_bucket:
            return ("For this role, make sure skills cover: "
                    + ", ".join(ROLE_KEYWORDS[role_bucket]) + ". Categorize them into "
                    "technical / tools / soft, and only list ones you can honestly speak to in an interview.")
        return "Categorize skills into technical / tools / soft and mirror the exact keywords from the job description you're targeting."

    return ("I'm your resume coach inside the builder. I can help quantify bullets, "
            "close keyword gaps for a target role, tighten your summary, check ATS fit, "
            "or rewrite weak phrasing — ask me something specific about the resume above.")

