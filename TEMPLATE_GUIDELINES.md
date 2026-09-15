# Resume Management System: Architecture, Security, & Template Creation Guidelines

This document specifies the architecture, cryptographic token isolation system, auto-discovery template engine, and step-by-step developer guidelines for the **ResumeForge / ResumeAI** platform.

---

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Cryptographic Token Isolation System](#2-cryptographic-token-isolation-system)
3. [Template & Data Separation Principle](#3-template--data-separation-principle)
4. [Future-Proof Template Registry & Auto-Discovery](#4-future-proof-template-registry--auto-discovery)
5. [Standardized Placeholder Specification](#5-standardized-placeholder-specification)
6. [Physical A4 Dimensions & High-Resolution Export Standards](#6-physical-a4-dimensions--high-resolution-export-standards)
7. [API Reference for Resumes & Templates](#7-api-reference-for-resumes--templates)
8. [Step-by-Step: Adding a New Resume Template](#8-step-by-step-adding-a-new-resume-template)

---

## 1. Architecture Overview

The system is architected around strict separation of concerns, cryptographic data isolation, and plug-and-play presentation modules:

```
                  ┌────────────────────────────────────────┐
                  │          Encrypted Token               │
                  │  (Salt + IV + Ciphertext + HMAC-Tag)   │
                  └──────────────────┬─────────────────────┘
                                     │ Validates authenticity,
                                     │ expiration & permissions
                                     ▼
┌───────────────────────┐   ┌─────────────────┐   ┌──────────────────────┐
│  Presentation Layer   │◄──┤ Dynamic Binding │──►│   Resume Data Layer  │
│  (Modular HTML/CSS)   │   │     Engine      │   │  (JSON Store / DB)   │
└───────────────────────┘   └─────────────────┘   └──────────────────────┘
            │                                                │
            ▼                                                ▼
┌───────────────────────┐                         ┌──────────────────────┐
│  resume_templates/    │                         │  Encrypted Instance  │
│  - classic.html       │                         │  Isolation           │
│  - modern.html        │                         │  (Owner, Scope, Exp) │
│  - obsidian.html      │                         └──────────────────────┘
│  - minimal.html       │
│  - executive.html     │
│  - bold.html          │
└───────────────────────┘
```

---

## 2. Cryptographic Token Isolation System

Each resume instance can be addressed by a self-contained, authenticated encrypted token. This guarantees data isolation, ownership validation, tamper prevention, and secure access across public links or headless clients without exposing raw database keys.

### Token Binary Structure
```
+---------------+---------------+-----------------------+-------------------+
|  Salt (16 B)  |   IV (16 B)   |  Ciphertext (Var B)   |  HMAC-Tag (32 B)  |
+---------------+---------------+-----------------------+-------------------+
```

### Encryption & Signing Flow
1. **Key Derivation:** Master secret `RESUME_ENCRYPTION_SECRET` + 16-byte random salt passed to `PBKDF2-HMAC-SHA256` (10,000 iterations) derives both a 32-byte Encryption Key (`K_enc`) and a 32-byte Authentication Key (`K_auth`).
2. **Keystream Encryption:** JSON payload is encrypted using a SHA-256 counter keystream initialized with `K_enc + IV`.
3. **Cryptographic Tagging:** An HMAC-SHA256 signature is calculated over `salt + iv + ciphertext` using `K_auth`.
4. **Encoding:** The composite binary payload is encoded as URL-safe Base64 without padding.

### Decryption & Verification Flow
- Validates minimum token length ($\ge 65$ bytes).
- Re-derives `K_enc` and `K_auth`.
- Verifies HMAC tag in constant time using `hmac.compare_digest`.
- Verifies timestamp against expiration timestamp (`exp`).
- Confirms granted permission scopes (`read`, `write`, `export`).

---

## 3. Template & Data Separation Principle

Templates are strictly presentation-layer markup:
- **No hardcoded content:** Templates contain zero hardcoded names, companies, or placeholder dummy text.
- **Dynamic placeholder resolution:** All data is populated via Mustache-style variable tags.
- **Semantic structure:** Templates use semantic HTML5 elements (`<article>`, `<header>`, `<main>`, `<section>`, `<nav>`) and ARIA landmarks (`role="document"`, `role="list"`, `aria-label`).
- **Standardized A4 styling:** Presentation rules adhere to physical A4 bounds ($210\text{ mm} \times 297\text{ mm}$).

---

## 4. Future-Proof Template Registry & Auto-Discovery

The registry is a **disk + player** model: the `resume_templates/` folder holds
templates ("disks"), and the website is the universal player that discovers and
renders whichever disks are present.

To add a new resume template:
1. Create a `.html` file (e.g., `resume_templates/creative.html`) — this is the
   **required** unit. It contains only structure + styling and `{{placeholders}}`;
   no resume content lives in the file (see §3 and §5).
2. Optionally include a `@template` JSON comment at the top of the file:
   ```html
   <!-- @template: {
     "id": "creative",
     "name": "Creative Portfolio",
     "category": "Creative",
     "desc": "Vibrant visual layout for designers and creators.",
     "tags": ["creative", "portfolio", "color"]
   } -->
   ```
3. Place the file in the `resume_templates/` directory. Optionally add a
   companion `<id>.json` for gallery labels/ordering — the `.json` enriches
   metadata but never registers a template by itself.
4. **Done.** The template is registered automatically on the **next request** —
   no restart, no `POST /api/templates/reload`, no redeploy, and **no database
   migrations or backend Python modifications**. Behind the scenes the service
   keeps a filesystem fingerprint of the folder and lazily re-scans on every
   read, so adding *or removing* a `.html` file is reflected immediately on the
   next `GET /api/templates`.
5. The browser also re-discovers templates on a short TTL, so a newly dropped
   disk shows up in the gallery/builder on the next page load with no code
   change.

### Player rendering (client + server)

Neither the server nor the live preview hard-codes template markup or CSS. Both
read the disk and inject data into its placeholders:

- **Server:** `POST /api/templates/{id}/render` → `template_service.render_template_html()`
- **Browser:** `TemplateEngine.renderModularInto(id, resume, targetEl)` in
  `static/js/template-engine.js` — an async client-side twin of the server
  renderer that fetches `GET /api/templates/{id}/raw` and injects the resume.
  Use it anywhere you want a live, disk-driven preview:
  ```js
  TemplateEngine.renderModularInto(resume.template, ResumeState.get(), previewEl);
  ```

Templates are fully isolated: `.html` files may even embed their own `<style>`
with a unique class prefix (see `resume_templates/zen.html`) so they carry zero
dependency on the site's global stylesheet. Removing such a file removes the
template from the site without affecting anything else.

---

## 5. Standardized Placeholder Specification

### Personal Info (`personal`)
| Placeholder | Description |
| :--- | :--- |
| `{{personal.fullName}}` | Candidate full name |
| `{{personal.title}}` | Professional title or target role |
| `{{personal.email}}` | Contact email address |
| `{{personal.phone}}` | Contact phone number |
| `{{personal.location}}` | Formatted location (City, Country) |
| `{{personal.linkedin}}` | LinkedIn profile URL |
| `{{personal.github}}` | GitHub profile URL |
| `{{personal.website}}` | Portfolio or personal website URL |
| `{{personal.photo}}` | Profile photo URL |

### Conditional Blocks
```html
{{#if summary}}
<section class="resume-section">
  <h2>Summary</h2>
  <p>{{summary}}</p>
</section>
{{/if}}
```

### Iteration Blocks (`#each`)

#### Work Experience (`experience`)
```html
{{#each experience}}
<div class="timeline-item">
  <div class="item-header">
    <h3>{{role}}{{#if company}} — {{company}}{{/if}}</h3>
    <span>{{start}}{{#if end}} – {{end}}{{/if}}</span>
  </div>
  {{#if location}}<div>{{location}}</div>{{/if}}
  {{#if bullets}}
  <ul>
    {{#each bullets}}
    <li>{{this}}</li>
    {{/each}}
  </ul>
  {{/if}}
</div>
{{/each}}
```

#### Education (`education`)
```html
{{#each education}}
<div class="timeline-item">
  <div class="item-header">
    <h3>{{degree}}{{#if field}}, {{field}}{{/if}}</h3>
    <span>{{start}}{{#if end}} – {{end}}{{/if}}</span>
  </div>
  <div>{{school}}{{#if gpa}} · GPA {{gpa}}{{/if}}</div>
  {{#if honors}}<div>Honors: {{honors}}</div>{{/if}}
  {{#if coursework}}<div>Coursework: {{coursework}}</div>{{/if}}
</div>
{{/each}}
```

#### Skills Categorization (`skills`)
```html
{{#if skills.technical}}
<div class="skill-group">
  <strong>Technical:</strong>
  {{#each skills.technical}}<span>{{this}}</span>{{/each}}
</div>
{{/if}}
```

#### Projects, Certifications, Languages
```html
{{#each projects}}
<div class="project-item">
  <h3>{{name}}{{#if role}} ({{role}}){{/if}}</h3>
  {{#if link}}<a href="{{link}}">Link</a>{{/if}}
  {{#if description}}<p>{{description}}</p>{{/if}}
</div>
{{/each}}
```

---

## 6. Physical A4 Dimensions & High-Resolution Export Standards

### Resolution Grid Reference
| Format / Use Case | DPI | Resolution (px) | html2canvas Scale |
| :--- | :--- | :--- | :--- |
| **High-Quality Print** | **300 DPI** | **2480 × 3508 px** | **3.1234** |
| **Draft Print / Flyers** | **150 DPI** | **1240 × 1754 px** | **1.5617** |
| **Standard Screen** | **96 DPI** | **794 × 1123 px** | **1.0000** |
| **Web Preview** | **72 DPI** | **595 × 842 px** | **0.7494** |

### CSS Page Break & Container Rules
```css
@page {
  size: 210mm 297mm;
  margin: 0;
}

.resume-page {
  width: 210mm;
  height: 297mm;
  min-height: 297mm;
  max-height: 297mm;
  box-sizing: border-box;
  page-break-after: always;
  break-after: page;
  page-break-inside: avoid;
  break-inside: avoid;
}
```

---

## 7. API Reference for Resumes & Templates

### Template Endpoints
- `GET /api/templates`: List all available templates and metadata.
- `GET /api/templates/{id}`: Get metadata configuration for a specific template.
- `GET /api/templates/{id}/raw`: Retrieve raw HTML template markup.
- `POST /api/templates/{id}/render`: Server-side render template with resume JSON.
- `POST /api/templates/reload`: Hot-reload template directory from disk.

### Encrypted Token Resume Endpoints
- `GET /api/resumes/{id}/token`: Generate an encrypted access token with specified permissions and expiration.
- `GET /api/resumes/secure/{token}`: Retrieve resume data using only the encrypted token.
- `PUT /api/resumes/secure/{token}`: Update resume data using an encrypted token with write permission.

---

## 8. Step-by-Step: Adding a New Resume Template

1. Open the `resume_templates/` folder.
2. Create a new file, for example: `resume_templates/compact.html`.
3. Add the template definition:
   ```html
   <!-- @template: {"id": "compact", "name": "Compact Tech", "category": "Technical", "desc": "High-density technical resume format.", "tags": ["compact", "tech", "dense"]} -->
   <article class="resume-sheet theme-compact" role="document" aria-label="Resume of {{personal.fullName}}">
     <header class="resume-header">
       <h1>{{personal.fullName}}</h1>
       <p>{{personal.title}}</p>
       <div class="contact-line">
         {{#if personal.email}}<span>{{personal.email}}</span>{{/if}}
         {{#if personal.phone}}<span>{{personal.phone}}</span>{{/if}}
         {{#if personal.location}}<span>{{personal.location}}</span>{{/if}}
       </div>
     </header>
     <main class="resume-body">
       {{#if summary}}
       <section class="resume-section">
         <h2>Summary</h2>
         <p>{{summary}}</p>
       </section>
       {{/if}}
       {{#if experience}}
       <section class="resume-section">
         <h2>Experience</h2>
         {{#each experience}}
         <div class="timeline-item">
           <h3>{{role}} — {{company}}</h3>
           <span>{{start}} – {{end}}</span>
           {{#if bullets}}
           <ul>{{#each bullets}}<li>{{this}}</li>{{/each}}</ul>
           {{/if}}
         </div>
         {{/each}}
       </section>
       {{/if}}
     </main>
   </article>
   ```
4. Save the file. The template is immediately active — auto-discovered in the
   gallery and builder on the **next request/page load** (no restart, no manual
   reload), and ready for dynamic rendering via `POST /api/templates/{id}/render`
   or `TemplateEngine.renderModularInto()`. Delete the `.html` file to remove it
   again, with no other code touched.
