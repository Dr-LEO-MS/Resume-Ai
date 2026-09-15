# Resume AI

An AI-powered resume builder: create a resume, get it AI-reviewed for grammar/clarity/ATS/keywords, one-click AI-enhance weak bullet points, export as PDF/Word, or share a link.

## Stack

- **Frontend:** plain HTML5 + CSS3 + vanilla JS (no framework). One shared stylesheet (`static/css/styles.css`), one shared theme system (CSS custom properties, light/dark mode).
- **Backend:** FastAPI (Python), SQLite by default (swap to Postgres via `DATABASE_URL`), JWT auth.
- **AI:** Claude (Anthropic) by default, with drop-in OpenAI and DeepSeek provider options — all prompt engineering lives in `api/ai_service.py`. Falls back to a deterministic offline mock if no API key is set, so the whole app is testable without one.

## Project structure

```
resumeai/
├── main.py                  # FastAPI app entrypoint, page + router wiring
├── requirements.txt
├── api/
│   ├── database.py          # SQLAlchemy engine/session
│   ├── models.py            # User, Resume ORM models
│   ├── schemas.py           # Pydantic request/response models
│   ├── auth.py               # password hashing + JWT
│   ├── ai_service.py         # ⭐ AI prompts + Claude/DeepSeek API calls (+ offline mock)
│   └── routers/
│       ├── auth_router.py     # /api/auth/*
│       ├── resumes_router.py  # /api/resumes/* (CRUD, requires login)
│       ├── ai_router.py       # /api/ai/* (check, enhance, enhance-text)
│       ├── export_router.py   # /api/export/* (pdf, docx, share-link)
│       └── misc_router.py     # /api/contact, /r/{slug} public share view
├── templates/                # Jinja2 HTML pages (all share _header.html / _footer.html)
│   ├── index.html            # landing page
│   ├── builder.html          # 3-panel editor (the core product)
│   ├── templates.html        # template gallery
│   ├── preview.html          # full-screen preview
│   ├── pricing.html / about.html / contact.html / dashboard.html
│   ├── _header.html / _footer.html
└── static/
    ├── css/styles.css         # ⭐ every style in the app, one file, commented sections
    ├── js/
    │   ├── state.js            # single source of truth for the resume being edited
    │   ├── storage.js          # localStorage + server autosave
    │   ├── template-engine.js  # renders resume JSON → HTML (preview + PDF use this)
    │   ├── ai-check.js         # calls /api/ai/check, renders score + suggestions
    │   ├── ai-enhance.js       # calls /api/ai/enhance & /enhance-text
    │   ├── ai-chat.js          # "AI Assistant" chat modal — calls /api/ai/chat
    │   ├── pdf-export.js       # unified PDF download: server → print → raster fallbacks + loading overlay
    │   ├── builder.js          # page controller wiring all of the above together
    │   └── main.js             # theme toggle, mobile nav (shared by every page)
    └── images/
```

## Builder UI Architecture

The Builder UI (`templates/builder.html` and `static/js/builder.js`) is the core engine of Resume AI. It implements a robust, single-page application (SPA) experience without relying on heavy frontend frameworks, utilizing purely HTML5, CSS3, and vanilla JavaScript.

**Core Layout:**
The UI is divided into two primary tabs toggled by the **Edit / Customize** tab bar:
1. **Edit Content Panel:** An accordion-style form for managing the resume's raw data (Personal Details, Summary, Experience, Education, Skills, Projects, Certifications, and Languages).
2. **Customize Design Panel:** A control center for visual presentation (Typography, Colors, Spacing, Bullet styles, Photo layout, and Page numbers). Changes here update CSS custom properties applied live to the template.

**Live Preview:**
Both tabs sit side-by-side with a persistent **Live Preview** panel on the right. The `template-engine.js` instantaneously renders the JSON state into HTML, applying the selected template and customizations in real-time as the user types or adjusts sliders.

**State Management & Autosave:**
- **State (`state.js`):** Acts as the single source of truth for the resume data model.
- **Storage (`storage.js`):** Handles transparent saving. It boots using browser `localStorage` for anonymous drafts and automatically switches to backend synchronization (`PUT /api/resumes/{id}`) once authenticated.

**AI Integration in the Builder:**
AI is embedded directly into the builder's fields and workflows:
- **AI Review Modal:** Provides an ATS score, keyword matching against target job descriptions, action verb analysis, and actionable content suggestions.
- **Inline AI Enhance (✦):** Context-aware buttons embedded in fields (job titles, bullets, project descriptions, summaries) that trigger AI rewrites of those specific fields.
- **AI Suggest Skills:** Infers plausible missing skills based on the user's entered work history.
- **AI Assistant Chat:** A context-aware chat popup (`ai-chat.js`) grounded in the current resume state that answers questions about formatting and content.

**Import & Export:**
- **Import Modal:** Users can upload PDF/DOCX files (parsed by the backend) or paste text/JSON; the extracted data is mapped seamlessly into the UI's unified JSON state.
- **Export Menu:** The UI requests server-side PDFs (`WeasyPrint`) and Word Docs (`python-docx`) that accurately replicate the chosen visual customization, with fallbacks to browser print dialogs if requested.

## Setup

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Optional but recommended — enables real AI responses instead of the mock.
# Pick a provider and set its key. Anthropic is default:
export ANTHROPIC_API_KEY=sk-ant-...      # Windows: set ANTHROPIC_API_KEY=...
# ...or switch providers entirely (choose one of the three):
export AI_PROVIDER=openai                 # "anthropic" (default), "openai", or "deepseek"
export OPENAI_API_KEY=sk-...
export OPENAI_MODEL=gpt-4o-mini           # optional; overrides OpenAI default
# DeepSeek (drop-in with OpenAI-compatible API):
export AI_PROVIDER=deepseek               # "deepseek" provider
export DEEPSEEK_API_KEY=sk-...            # DeepSeek API key
export DEEPSEEK_MODEL=deepseek-chat       # optional; overrides DeepSeek default

# Optional — override AI model defaults:
export AI_MODEL=claude-sonnet-4-6         # optional; overrides Claude default

# Optional — override defaults:
export DATABASE_URL=sqlite:///./resumeai.db
export JWT_SECRET=some-long-random-string

# Optional — enables "Continue with Google" on /login. Create an OAuth 2.0
# Web client at console.cloud.google.com (Authorized JavaScript origins must
# include http://127.0.0.1:8000 and your production domain), then set:
export GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com

uvicorn main:app --reload
```

Open **http://127.0.0.1:8000**.

> Without an API key set, `/api/ai/check`, `/api/ai/enhance*`, and `/api/ai/chat` still work — they return
> a rule-based offline mock (weak-verb detection, missing-metric flags, keyword gaps) so you can build and test
> the whole UI before wiring up billing/API keys.

## Customization

- **Colors, fonts, spacing:** edit the `:root` block at the top of `static/css/styles.css` (section 1). Everything else references those variables — change one value, the whole site updates.
- **Dark mode palette:** the `html[data-theme='dark']` block right below `:root`.
- **New resume template/theme:** add a `.resume-doc.theme-<id>` CSS block (section 10 of `styles.css`), then add the id to `TEMPLATE_IDS` in `static/js/template-engine.js` and to the `templates` list in `templates/templates.html`. No JS logic changes needed — layout is shared, only CSS differs per theme.
- **New resume section (e.g. "Awards"):** add a key to the default object in `static/js/state.js`, a case in `renderSection()` in `template-engine.js`, a form renderer in `builder.js`, and add the id to `SECTION_LABELS`.
- **AI prompts:** everything the AI is told to do lives in `api/ai_service.py` as plain strings (`CHECK_SYSTEM_PROMPT`, `ENHANCE_SYSTEM_PROMPT`, `ENHANCE_TEXT_SYSTEM_PROMPT`). Edit the text directly — no other code changes required.

## AI agent prompt reference

The three prompts your AI agent/model actually runs on are defined in `api/ai_service.py`:

| Prompt | Used for | Returns |
|---|---|---|
| `CHECK_SYSTEM_PROMPT` | `POST /api/ai/check` | JSON: `score`, `subscores`, list of `suggestions` (grammar, weak verbs, missing metrics, keyword gaps, ATS risk) |
| `ENHANCE_SYSTEM_PROMPT` | `POST /api/ai/enhance` | Full rewritten resume JSON, same shape, stronger wording |
| `ENHANCE_TEXT_SYSTEM_PROMPT` | `POST /api/ai/enhance-text` | One rewritten bullet or summary string |

Both are written to **never invent facts** (no fake metrics, employers, or dates) — they only
rephrase, strengthen verbs, and flag gaps for the user to fill in themselves.

## API documentation

Interactive Swagger docs are auto-generated by FastAPI at **`/docs`** once the server is running.

Key endpoints:

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create account, returns JWT |
| POST | `/api/auth/login` | — | Returns JWT |
| GET | `/api/auth/me` | Bearer | Current user |
| GET/POST | `/api/resumes` | Bearer | List / create saved resumes |
| PUT/DELETE | `/api/resumes/{id}` | Bearer | Update / delete a resume |
| POST | `/api/ai/check` | optional | Score + suggestions for a resume JSON |
| POST | `/api/ai/enhance` | optional | Full resume rewrite |
| POST | `/api/ai/enhance-text` | optional | Rewrite one bullet/summary |
| POST | `/api/export/pdf` | optional | Server-rendered PDF (requires `weasyprint`) |
| POST | `/api/export/docx` | optional | Word doc (requires `python-docx`) |
| POST | `/api/export/share-link` | optional | Public read-only link |
| POST | `/api/contact` | — | Contact form |

## DeepSeek AI provider (latest)

- **DeepSeek integration**: `api/ai_service.py` now supports `AI_PROVIDER=deepseek` as a third provider alongside Anthropic (default) and OpenAI. Set `DEEPSEEK_API_KEY` (and optionally `DEEPSEEK_MODEL`, defaults to `deepseek-chat`). The DeepSeek API is OpenAI-compatible, so no new SDK dependency is required — it reuses the existing `openai` package with a custom `base_url` of `https://api.deepseek.com/v1`. All existing features (AI Review, AI Enhance, Resume Import, AI Assistant chat) work with DeepSeek automatically when the provider is selected.

## Deployment notes

- Set `DATABASE_URL` to a managed Postgres instance; SQLite is fine for a single-instance demo but won't survive redeploys on most PaaS platforms.
- Set `JWT_SECRET` to a long random value — never use the dev default in production.
- Set `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `DEEPSEEK_API_KEY` as a secret, not in source control.
- `weasyprint` needs system libraries (Pango/Cairo) — on Debian/Ubuntu: `apt-get install libpango-1.0-0 libpangocairo-1.0-0`. If you'd rather avoid that dependency, or it isn't installable on your host (e.g. Windows), no problem: the "Download PDF" button automatically falls back to the browser's print-to-PDF, then to client-side raster rendering — nothing extra is required, so PDF export always works.
- Put this behind HTTPS and set `allow_origins` in `main.py`'s CORS middleware to your real domain before going live.

## Recent fixes (this round)

- **PDF watermark removed.** The Download PDF button now calls the server-side WeasyPrint export instead of the browser's print dialog — the date/time/URL watermark only ever came from a browser print, never from this app's own PDF generation.
- **Skills export bug fixed.** PDF/DOCX downloads were printing the literal text `"technical, tools, soft"` instead of your actual skills (a dict-vs-list bug). Fixed and verified against a real generated file.
- **All sections now export.** Education, Projects, Certifications, Languages, and photo were previously missing from PDF/DOCX; `export_router.py` was rewritten as a faithful Python port of `template-engine.js`'s renderer.
- **DOCX now matches your template/customization** — heading color and font applied as real run-level Word formatting.
- **Page numbers work** in both formats — real CSS Paged Media counters in the PDF, a real Word field code in the DOCX footer, both driven by `resume.customization.pageNumbers`.
- **Customization now actually renders.** The font-size/color/spacing data model already existed, but `styles.css` never consumed any of those CSS variables. All 5 templates redesigned and the variables wired through.
- **AI Enhance/Check fixed** — the offline fallback only caught weak phrases at the very start of a sentence; it now catches them anywhere in the text.
- **`/reset-password` no longer 500s.**
- **Password eye-toggle** added site-wide; **Forgot password** flow added to `/login`.
- **Branding renamed** to "Resume AI" everywhere.
- **Critical fix: the builder now actually saves to your account.** It previously only wrote to browser `localStorage` — nothing built in the builder ever reached the dashboard, plan limits, or another device. Verified end-to-end: register → build → dashboard → limit enforcement → export.
- **Dashboard rebuilt**: real live-rendered thumbnails, a "Customize" button that opens the Design & Photo panel directly, and limit-aware Create buttons for both resumes and cover letters (free plan: 1 of each, enforced server-side with a real HTTP 402).

## Admin panel — full site control (this round)

The admin panel now genuinely controls the whole site, not just user accounts:

- **Settings** (`/admin` → Settings): site name/hero copy/contact email, branding (logo text + primary/accent color — applied live via a CSS override), plan limits (free-tier resume/cover-letter caps — was hardcoded, now a live setting), pricing display labels, feature flags (AI Review, AI Enhance, cover letters, sharing, registration, PDF export, DOCX export — each one is enforced **server-side**, not just hidden in the UI), and outbound SMTP config for password-reset/plan-expiry emails.
- **Templates** (`/admin` → Templates): enable/disable, reorder, and edit each template's name/color/font. This writes straight to the template's `.json` file in `/resume_templates`, so it's live in the gallery, builder, and PDF/DOCX export immediately — disabled templates disappear from `/api/templates` but stay editable/re-enable-able from the admin panel.
- **Audit Log** (`/admin` → Audit Log): every settings change, template edit, user plan/role change, and deletion is recorded with who did it and when.

All of this was verified end-to-end while building it: changed the hero headline via the API and confirmed it appeared on the live landing page with no restart; disabled AI Review and confirmed the endpoint started returning a real 403; raised the free-tier resume limit and confirmed a brand-new user immediately got the new cap; disabled a template and confirmed it dropped out of the public gallery while staying visible (and re-enable-able) in the admin list; confirmed the template JSON file on disk was actually rewritten, not just cached; and confirmed every one of those actions showed up in the audit log.

**What's still out of scope:** there's no payment processor, so the pricing labels are cosmetic — an admin can change what `/pricing` *displays*, not what anyone is actually billed. Branding is limited to text + 2 colors, not a logo image upload or a full visual theme editor.

## AI agent upgrade (this round)

The AI Review / AI Enhance / AI Suggest system was rebuilt to be genuinely professional-grade, not a placeholder:

- **`api/ai_service.py`** — all three core prompts rewritten with a triple-persona reviewer (senior technical recruiter + ATS parsing specialist + honest career coach), explicit "score honestly, not encouragingly" instruction, and specific-not-vague keyword-gap requirements.
- **New `/api/ai/suggest-skills` endpoint** — infers plausible missing skills from the candidate's actual job titles and experience bullets (not generic filler), powers a new "✦ AI Suggest Skills" button in the builder's Skills section.
- **`AIEnhanceTextRequest.kind` extended** to 6 field types: `bullet`, `summary`, `title`, `project_description`, `certification`, `skill_label`, `education_field` — each with its own tailored rewrite rules.
- **New AI-suggest buttons** wired into the builder: Job Title field, Project Description field, and the Skills section's bulk-suggest button, in addition to the existing Summary and Experience-bullet buttons.
- **New target-role input** above AI Review — lets the candidate specify the job title they're targeting so keyword-gap analysis is tailored to that specific role instead of only inferred from their current title.
- **Offline fallback substantially upgraded** (used automatically when `ANTHROPIC_API_KEY` isn't set): added a curated keyword bank across 9 common roles (software engineer, data scientist, data analyst, product manager, designer, marketing, sales, devops, project manager), passive-voice detection, bullet-length checks, and thin-skills-section detection — real heuristics, not a toy fallback.
- **Fixed a real grammar bug found during testing**: the offline mock was rewriting "Was responsible for X" to the broken "Was led X" (only replacing the inner phrase, leaving a dangling auxiliary verb). Fixed to consume the leading auxiliary and produce "Led X" — verified via direct unit test.

**Verified live** (not just written): target-role-driven keyword gaps, skill suggestions on a realistic resume, title/project-description rewrites, and the corrected weak-verb grammar — all confirmed against real API responses during this round, plus a full regression pass confirming PDF export, builder, dashboard, and admin pages all still work unchanged.

## AI Assistant chat + provider abstraction (latest)

- **💬 AI Assistant modal** (`static/js/ai-chat.js` + `POST /api/ai/chat`): a resume-grounded chat popup in the builder. The assistant can see the live resume and answers questions about it — quantify bullets, keyword/ATS gaps, summary rewrites, length, skills — with quick-prompt chips, message history, and a typing indicator. All prompt engineering lives in `CHAT_SYSTEM_PROMPT` / `chat_with_resume()` in `api/ai_service.py`.
- **Upgraded AI Review modal**: `✦ AI Review` now opens the score ring + suggestion cards in a proper modal dialog instead of the inline panel, so there's room for every per-section fix to stay visible alongside the preview.
- **Custom model/provider integration**: `api/ai_service.py` now dispatches on `AI_PROVIDER` (`anthropic` default, or `openai` via `OPENAI_API_KEY` / `OPENAI_MODEL`). Everything above `_call_model` / `_call_chat` is provider-agnostic — swapping models is a config change, not a code change. The offline mocks still power every feature with no key configured.

## Google sign-in + per-account cache isolation (latest)

- **"Continue with Google"** (`/login`, both tabs): Google Identity Services button → ID token verified server-side at `POST /api/auth/google` (`api/google_auth.py`, audience-checked against `GOOGLE_CLIENT_ID`). Existing password accounts with the same email are automatically linked, so both sign-in methods work; brand-new Google users get an account with an unguessable placeholder password hash. Set `GOOGLE_CLIENT_ID` to enable — the button hides itself when it's unset.
- **Logout clears local cache**: signing out (and starting any new session) wipes the per-device resume cache (`resumeai:current` draft + `resumeai:saved` list) in `Auth.clearResumeData()` — so switching between accounts on the same browser never shows one account's entered information to another. Server-side resumes still reload from `/api/resumes` for whoever is actually signed in.
- **Backend-enforced AI usage limits (spec §10)**: every AI endpoint now logs to a new `ai_usage_log` table and rejects free-plan users past `plan_limits.ai_actions_free_per_day` (default 15/day; pro/teams unlimited) with HTTP 402 — server-side, not just hidden in the UI.
- **GitHub field + short clickable links (spec §8, §12–§14, §16)**: new GitHub profile field alongside LinkedIn/Portfolio everywhere (builder form, resume state, PDF/DOCX/TXT export, import parsing). Contact links now render as short labels (`linkedin.com/in/you`) with clickable underlying URLs — long URLs are never displayed. The new Check Links tool reviews presence/length/duplicates and explicitly does not claim links work.
- **Accept / Edit / Reject on every suggestion (spec §7, §9)**: suggestion cards now have all three actions — Edit opens an inline textarea whose edited text is what Accept applies; accepted changes update the live preview immediately.

#   R e s u m e - A i  
 #   R e s u m e - A i  
 #   R e s u m e - A i  
 