<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=32&duration=3000&pause=1000&color=5B5BD6&center=true&vCenter=true&width=600&lines=Resume+AI;AI-Powered+Resume+Builder;Build.+Review.+Enhance.+Land+the+Interview." alt="Typing SVG" />

<p align="center">
  <b>Create a resume, get it AI-reviewed for grammar/clarity/ATS/keywords, one-click AI-enhance weak bullet points, export as PDF/Word, or share a link.</b>
</p>

<p align="center">
  <a href="https://resume-ai-leo.vercel.app"><img src="https://img.shields.io/badge/🚀_Live_Demo-resume--ai--leo.vercel.app-5B5BD6?style=for-the-badge" alt="Live Demo"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/FastAPI-async-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/PostgreSQL-production-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Vercel-deployed-000000?style=flat-square&logo=vercel&logoColor=white" alt="Vercel">
  <img src="https://img.shields.io/badge/JavaScript-vanilla-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="Vanilla JS">
  <img src="https://img.shields.io/badge/AI-Claude_%7C_OpenAI_%7C_DeepSeek-8A2BE2?style=flat-square" alt="Multi-provider AI">
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-project-structure">Structure</a> •
  <a href="#-api-reference">API</a> •
  <a href="#-whats-new">What's New</a>
</p>

</div>

<br>

## ✨ Features

<table>
<tr>
<td width="50%" valign="top">

**📝 Smart Builder**
- Accordion-style content editor (Personal, Experience, Education, Skills, Projects, Certs, Languages)
- Side-by-side live preview, updated on every keystroke
- Drag-to-reorder sections
- Import from PDF/DOCX or paste text/JSON

**🎨 Full Design Control**
- Typography, colors, spacing, bullet style, page numbers
- 5 built-in templates, fully theme-able via CSS variables
- Photo layout controls

</td>
<td width="50%" valign="top">

**🤖 AI Built In, Not Bolted On**
- AI Review — ATS score, keyword gaps, action-verb analysis
- Inline ✦ Enhance on every field (titles, bullets, summaries, project descriptions)
- AI Suggest Skills — infers missing skills from your work history
- AI Assistant chat, grounded in your live resume
- Works with **Claude, OpenAI, or DeepSeek** — swap providers with one env var

**📤 Real Exports**
- Server-rendered PDF (WeasyPrint) and Word (python-docx) that actually match your customization
- Shareable read-only links

</td>
</tr>
</table>

<div align="center">
<sub>💡 No AI key? No problem — every AI feature has a deterministic offline fallback so the whole app is testable out of the box.</sub>
</div>

<br>

## 🖥️ Screenshots

<div align="center">
<i>Add screenshots or a demo GIF here — drop images into <code>docs/screenshots/</code> and reference them below for a much stronger first impression on GitHub.</i>

<br><br>

| Builder | AI Review |
|:---:|:---:|
| `docs/screenshots/builder.png` | `docs/screenshots/ai-review.png` |

</div>

<br>

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Plain HTML5 / CSS3 / vanilla JS — no framework, one shared stylesheet, CSS-variable theming (light/dark) |
| **Backend** | FastAPI (Python), SQLAlchemy, JWT auth |
| **Database** | PostgreSQL in production, SQLite for local dev |
| **AI** | Claude (default) · OpenAI · DeepSeek — provider-agnostic via `AI_PROVIDER` |
| **Export** | WeasyPrint (PDF) · python-docx (Word) |
| **Hosting** | Vercel — serverless Python/ASGI via `a2wsgi` |

<br>

## 🚀 Quick Start

```bash
git clone <your-repo-url>
cd resumeai
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

<details>
<summary><b>🔑 Environment variables (click to expand)</b></summary>

<br>

```bash
# Optional but recommended — enables real AI responses instead of the offline mock.
# Pick a provider and set its key. Anthropic is default:
export ANTHROPIC_API_KEY=sk-ant-...

# ...or switch providers entirely (choose one of the three):
export AI_PROVIDER=openai                 # "anthropic" (default) | "openai" | "deepseek"
export OPENAI_API_KEY=sk-...
export OPENAI_MODEL=gpt-4o-mini           # optional override

export AI_PROVIDER=deepseek
export DEEPSEEK_API_KEY=sk-...
export DEEPSEEK_MODEL=deepseek-chat       # optional override

export AI_MODEL=claude-sonnet-4-6         # optional — overrides the Claude default

# Database & auth
export DATABASE_URL=sqlite:///./resumeai.db
export JWT_SECRET=some-long-random-string

# Optional — "Continue with Google" on /login
# Create an OAuth 2.0 Web client at console.cloud.google.com (Authorized
# JavaScript origins must include http://127.0.0.1:8000 and your prod URL):
export GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
```

</details>

```bash
uvicorn main:app --reload
```

Open **http://127.0.0.1:8000** 🎉

<br>

## 📁 Project Structure

<details>
<summary><b>Click to expand full file tree</b></summary>

```
resumeai/
├── main.py                  # FastAPI app entrypoint, page + router wiring
├── requirements.txt
├── api/
│   ├── database.py          # SQLAlchemy engine/session
│   ├── models.py            # User, Resume ORM models
│   ├── schemas.py           # Pydantic request/response models
│   ├── auth.py               # password hashing + JWT
│   ├── google_auth.py        # "Continue with Google" ID token verification
│   ├── ai_service.py         # ⭐ AI prompts + Claude/OpenAI/DeepSeek calls (+ offline mock)
│   └── routers/
│       ├── auth_router.py     # /api/auth/*
│       ├── resumes_router.py  # /api/resumes/* (CRUD, requires login)
│       ├── ai_router.py       # /api/ai/* (check, enhance, chat, suggest-skills)
│       ├── export_router.py   # /api/export/* (pdf, docx, share-link)
│       └── misc_router.py     # /api/contact, /r/{slug} public share view
├── templates/                # Jinja2 HTML pages (share _header.html / _footer.html)
│   ├── index.html            # landing page
│   ├── builder.html          # Edit / Customize accordion editor (the core product)
│   ├── templates.html        # template gallery
│   ├── preview.html          # full-screen preview
│   ├── pricing.html / about.html / contact.html / dashboard.html
│   └── _header.html / _footer.html
└── static/
    ├── css/styles.css         # ⭐ every style in the app, one file, commented sections
    ├── js/
    │   ├── state.js            # single source of truth for the resume being edited
    │   ├── storage.js          # localStorage + server autosave
    │   ├── template-engine.js  # renders resume JSON → HTML (preview + PDF use this)
    │   ├── ai-check.js         # calls /api/ai/check, renders score + suggestions
    │   ├── ai-enhance.js       # calls /api/ai/enhance & /enhance-text
    │   ├── ai-chat.js          # AI Assistant chat modal — calls /api/ai/chat
    │   ├── pdf-export.js       # PDF download: server → print → raster fallbacks
    │   ├── builder.js          # page controller wiring all of the above together
    │   └── main.js             # theme toggle, mobile nav (shared by every page)
    └── images/
```

</details>

<br>

## 🏗 Architecture Deep Dive

<details>
<summary><b>Builder UI — the core engine (click to expand)</b></summary>

<br>

The Builder (`templates/builder.html` + `static/js/builder.js`) is a single-page experience built with zero frontend frameworks.

**Core layout** — two tabs, one persistent live preview:
1. **Edit Content** — accordion form for raw data (Personal, Summary, Experience, Education, Skills, Projects, Certifications, Languages)
2. **Customize Design** — typography, colors, spacing, bullet style, photo layout, page numbers — all applied live via CSS custom properties

**State & autosave**
- `state.js` is the single source of truth for the resume data model
- `storage.js` boots from `localStorage` for anonymous drafts, then transparently switches to `PUT /api/resumes/{id}` once authenticated

**AI, embedded everywhere**
- **AI Review modal** — ATS score, keyword matching against a target role, action-verb analysis
- **Inline ✦ Enhance** — per-field rewrite buttons on titles, bullets, project descriptions, summaries
- **AI Suggest Skills** — infers missing skills from work history
- **AI Assistant chat** — context-aware, grounded in the live resume state

**Import & Export**
- Import PDF/DOCX (server-parsed) or paste text/JSON — mapped into the unified state model
- Export requests server-rendered PDF (WeasyPrint) and DOCX (python-docx) that faithfully reproduce the chosen customization, with print-dialog/raster fallbacks if the server path is unavailable

</details>

<br>

## 📡 API Reference

Interactive Swagger docs are auto-generated at **[`/docs`](http://127.0.0.1:8000/docs)** once the server is running.

| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `POST` | `/api/auth/register` | — | Create account, returns JWT |
| `POST` | `/api/auth/login` | — | Returns JWT |
| `POST` | `/api/auth/google` | — | Google ID-token sign-in |
| `GET` | `/api/auth/me` | 🔒 | Current user |
| `GET`/`POST` | `/api/resumes` | 🔒 | List / create saved resumes |
| `PUT`/`DELETE` | `/api/resumes/{id}` | 🔒 | Update / delete a resume |
| `POST` | `/api/ai/check` | optional | Score + suggestions for a resume |
| `POST` | `/api/ai/enhance` | optional | Full resume rewrite |
| `POST` | `/api/ai/enhance-text` | optional | Rewrite one field |
| `POST` | `/api/ai/suggest-skills` | optional | Infer missing skills |
| `POST` | `/api/ai/chat` | optional | Resume-grounded AI Assistant |
| `POST` | `/api/export/pdf` | optional | Server-rendered PDF |
| `POST` | `/api/export/docx` | optional | Word document |
| `POST` | `/api/export/share-link` | optional | Public read-only link |
| `POST` | `/api/contact` | — | Contact form |

<br>

## 🎨 Customization

| Want to change... | Edit... |
|---|---|
| Colors, fonts, spacing globally | `:root` block, top of `static/css/styles.css` |
| Dark mode palette | `html[data-theme='dark']` block, same file |
| Add a new resume template | New `.resume-doc.theme-<id>` CSS block + add the id to `TEMPLATE_IDS` in `template-engine.js` and `templates.html` |
| Add a new resume section (e.g. "Awards") | Default object in `state.js`, a case in `renderSection()` in `template-engine.js`, a form renderer in `builder.js`, add id to `SECTION_LABELS` |
| AI prompts / tone | Plain strings in `api/ai_service.py` (`CHECK_SYSTEM_PROMPT`, `ENHANCE_SYSTEM_PROMPT`, `CHAT_SYSTEM_PROMPT`, …) — no other code changes needed |

<br>

## ☁️ Deployment Notes

- Point `DATABASE_URL` at a managed Postgres instance — SQLite is fine for local dev but won't survive redeploys on serverless platforms like Vercel.
- **Vercel** is the deployment target: the Python runtime auto-detects FastAPI from `requirements.txt` and routes *every* request to the app (so no `rewrites` are needed — a catch-all rewrite would rewrite the request path). Pin the runtime with `.python-version`, and set `DATABASE_URL`, `JWT_SECRET`, and `CORS_ORIGINS` under Project → Settings → Environment Variables.
- Set `JWT_SECRET` to a long random value in production — never ship the dev default.
- Set `APP_BASE_URL` to your live domain so password-reset/plan emails link correctly.
- Set your chosen AI provider's key (`ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `DEEPSEEK_API_KEY`) as a secret — never in source control.
- `weasyprint` needs system libraries (Pango/Cairo) on the host. If that's not available (e.g. some Windows setups), no action needed — PDF export automatically falls back to the browser's print dialog, then client-side raster rendering.
- Lock down CORS: set the `CORS_ORIGINS` env var to your production origin(s) (comma-separated, e.g. `https://your-domain.com`) — it defaults to `*` when unset.

<br>

## 📌 What's New

<details open>
<summary><b>🔐 Google sign-in, per-account isolation & short links</b></summary>

<br>

- **"Continue with Google"** on `/login` — server-verified ID token (`api/google_auth.py`), auto-links to an existing password account with the same email.
- **Per-account cache isolation** — signing out wipes the local draft/cache so switching accounts on one browser never leaks data between users.
- **Backend-enforced AI usage limits** — every AI call is logged to `ai_usage_log`; free-plan users are capped (default 15/day) with a real `402`, not just a hidden button.
- **GitHub field + short clickable links** — contact links render as short labels (`linkedin.com/in/you`) with the full URL underneath, everywhere (builder, PDF/DOCX/TXT, import).
- **Accept / Edit / Reject** on every AI suggestion card, with live preview updates on Accept.

</details>

<details>
<summary><b>💬 AI Assistant chat + provider abstraction</b></summary>

<br>

- New **AI Assistant modal** — a resume-grounded chat that answers questions about your resume (quantify a bullet, check ATS gaps, rewrite the summary, etc.), with quick-prompt chips and message history.
- **AI Review** now opens as a full modal instead of a squeezed inline panel.
- **Multi-provider AI**: `AI_PROVIDER` env var switches between Anthropic (default) and OpenAI with zero code changes.

</details>

<details>
<summary><b>🧠 Professional-grade AI Review / Enhance / Suggest</b></summary>

<br>

- All AI prompts rewritten with a triple-persona reviewer (recruiter + ATS specialist + honest career coach) — "score honestly, not encouragingly."
- New `/api/ai/suggest-skills` endpoint, powering a bulk skills-suggestion button.
- AI enhancement extended to 6 field types: bullets, summaries, titles, project descriptions, certifications, education fields.
- Offline fallback upgraded with a real keyword bank across 9 common roles, passive-voice detection, and thin-skills-section detection.

</details>

<details>
<summary><b>🛠 Critical fixes — exports, autosave, dashboard</b></summary>

<br>

- **Watermark-free PDFs** — download now goes through server-side WeasyPrint instead of the browser print dialog.
- **Skills export bug fixed** — PDF/DOCX previously printed literal category names instead of actual skills.
- **All sections now export** — Education, Projects, Certifications, Languages, and photo were missing from PDF/DOCX; the exporter is now a faithful port of the live preview renderer.
- **DOCX matches your customization** — real run-level Word formatting for fonts and colors, not just plain text.
- **The builder now actually saves to your account** — previously wrote to `localStorage` only, never reaching the dashboard or plan limits. Verified end-to-end.
- **Dashboard rebuilt** — live-rendered thumbnails, a direct Customize button, limit-aware Create buttons.

</details>

<details>
<summary><b>⚙️ Full-control admin panel</b></summary>

<br>

- **Settings** — site copy, branding, plan limits, pricing labels, and feature flags (AI Review, AI Enhance, cover letters, sharing, registration, PDF/DOCX export) — each flag enforced **server-side**.
- **Templates** — enable/disable, reorder, and edit each template live from the admin panel; writes straight to the template's JSON file.
- **Audit Log** — every settings change, template edit, plan/role change, and deletion recorded with who and when.

> No payment processor is wired in — pricing labels are cosmetic, not billing.

</details>

<br>

---

<div align="center">

**[⬆ Back to top](#)**

Made with ☕ and an unreasonable number of AI-assisted rewrites.

</div>