# Resume Templates

This folder is the **template library**. The website is a universal "player":
it scans this folder, discovers every template automatically, and renders any
one by injecting the resume's data into the template's `{{placeholders}}`.

## The template "disk" model

Each template is a single, self-contained unit (a "disk"):

- **`<id>.html`** — *required.* The complete visual/styling framework: structural
  markup **plus** any CSS the design needs. It may carry its metadata in a
  `@template` JSON header comment. It contains **no resume content** — only
  `{{placeholders}}` that the player fills in.
- **`<id>.json`** — *optional.* Extra metadata (name, tags, category, featured,
  style defaults) used to build the gallery UI. It *never* registers a template
  by itself; the `.html` file is what makes a template exist.

> **Isolation:** templates share nothing. Remove a template's `.html` file and
> it disappears from the website's options on the very next request — nothing
> else is affected. Files can even embed their own `<style>` (see `zen.html`)
> so they don't depend on the site's global stylesheet.

## Auto-discovery (no restart, no code changes)

The backend checks this folder's filesystem fingerprint on every read. Adding
or removing a `.html`/`.json` file is reflected on the **next request** — no
server restart, no `POST /api/templates/reload`, no redeploy. The frontend
re-queries `/api/templates` on a short TTL so the change shows in the gallery
on the next page load too.

## Standardized data contract

Every template receives the same object and uses the same placeholder syntax:

| Placeholder | Meaning |
|-------------|---------|
| `{{personal.fullName}}`, `{{personal.email}}`, ... | Contact / identity fields |
| `{{summary}}` | Profile summary (markdown-lite string) |
| `{{#if skills.technical}}...{{/if}}` | Conditionally render a block |
| `{{#each experience}}...{{/each}}` | Loop an array (experience, education, projects, certifications, languages) |
| `{{role}}`, `{{company}}`, `{{start}}`, `{{end}}`, `{{current}}` | Experience item fields |
| `{{#each bullets}}<li>{{this}}</li>{{/each}}` | Nested bullet lists |
| `{{degree}}`, `{{field}}`, `{{school}}`, `{{gpa}}` | Education item fields |
| `{{name}}`, `{{description}}`, `{{link}}`, `{{role}}` | Projects item fields |
| `{{name}}`, `{{issuer}}`, `{{date}}` | Certifications item fields |
| `{{name}}`, `{{level}}` | Languages item fields |

`{{#if}}`/`{{#each}}` blocks may be freely nested to any depth.

## Adding a template (drop-in)

1. Create `resume_templates/<your-id>.html` with the `@template` metadata header
   and structural markup + `{{placeholders}}`.
2. Optionally add `<your-id>.json` for gallery labels/ordering.
3. **Done.** It appears in `GET /api/templates`, the gallery, and server/client
   renderers on the next request/load. No code edits.

## Removing a template

Delete `<your-id>.html` (and optionally its `.json`). The template is removed
from the registry on the next request — no other template or feature is touched.
