"""
template_service.py
-------------------------------------------------------------------------
Future-Proof Resume Template Discovery & Dynamic Presentation Engine.

Supports:
  1. Auto-discovery of template files (.json metadata and .html templates)
     directly from the /resume_templates directory without backend code changes
     or database schema modifications.
  2. Automatic parsing of inline metadata headers in HTML template files:
     <!-- @template: {"id": "...", "name": "...", "category": "..."} -->
  3. Dynamic presentation rendering and placeholder data binding:
     Standardized Mustache-style variables ({{personal.fullName}}, {{#each experience}}...)
  4. Template registry caching with dynamic runtime reloading.
-------------------------------------------------------------------------
"""

import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "resume_templates"

_cache: List[Dict[str, Any]] = []

# ----------------------------------------------------------------------------
# Filesystem-fingerprint auto-discovery.
#
# Instead of only scanning once at startup (or requiring a manual POST to
# /api/templates/reload), we record a cheap fingerprint of the templates
# directory (sorted filenames + mtimes) and lazily re-scan whenever it
# changes. Because get_all()/get_by_id()/get_public() all funnel through this
# check, dropping in a new .html/.json file — or deleting one — is reflected
# on the very next request. No restart, no redeploy, no manual reload.
# ----------------------------------------------------------------------------
_TEMPLATE_SUFFIXES = (".html", ".json")
_fingerprint: Optional[tuple] = None


def _dir_fingerprint() -> Optional[tuple]:
    """A cheap, order-stable snapshot of the templates directory contents.

    Any added/removed/edited .html or .json file changes the fingerprint,
    which triggers a lazy re-scan on the next read.
    """
    if not TEMPLATES_DIR.exists():
        return None
    try:
        entries = sorted(
            p.name
            for p in TEMPLATES_DIR.iterdir()
            if p.is_file() and p.suffix.lower() in _TEMPLATE_SUFFIXES
        )
        # Combine names + mtimes so *content edits* also invalidate the cache,
        # while still yielding on the next request.
        rows = [f"{name}:{p.stat().st_mtime_ns}" for name, p in ((e, TEMPLATES_DIR / e) for e in entries)]
        return (entries, rows)
    except OSError:
        return None


def _template_store_changed() -> bool:
    """True when the templates directory differs from the last recorded scan."""
    global _fingerprint
    current = _dir_fingerprint()
    if current is None:
        return _fingerprint is not None  # directory disappeared -> refresh
    return current != _fingerprint


def _extract_html_metadata(html_content: str, filename: str) -> Optional[Dict[str, Any]]:
    """Extract embedded JSON metadata comment from HTML template header."""
    match = re.search(r"<!--\s*@template:\s*(\{.*?\})\s*-->", html_content, re.DOTALL)
    if match:
        try:
            meta = json.loads(match.group(1))
            return meta
        except Exception as e:
            print(f"[template_service] Failed to parse @template JSON in {filename}: {e}")
    return None


def _load_all() -> List[Dict[str, Any]]:
    """
    Scan the templates directory and load all templates.
    Discovers both .json configuration files and modular .html presentation files.
    """
    templates_by_id: Dict[str, Dict[str, Any]] = {}

    if not TEMPLATES_DIR.exists():
        return []

    # 1. Scan and load all JSON template definitions
    for filepath in sorted(TEMPLATES_DIR.glob("*.json")):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            if "id" not in data or "name" not in data:
                continue
            tid = data["id"]
            data["_file"] = filepath.name
            data["_has_html"] = False
            templates_by_id[tid] = data
        except (json.JSONDecodeError, OSError) as e:
            print(f"[template_service] Skipped {filepath.name}: {e}")

    # 2. Scan and load all HTML template definitions
    for filepath in sorted(TEMPLATES_DIR.glob("*.html")):
        try:
            tid = filepath.stem
            with open(filepath, "r", encoding="utf-8") as f:
                html_str = f.read()

            html_meta = _extract_html_metadata(html_str, filepath.name)

            if tid in templates_by_id:
                templates_by_id[tid]["_has_html"] = True
                templates_by_id[tid]["_html_file"] = filepath.name
                if html_meta:
                    for k, v in html_meta.items():
                        if k not in templates_by_id[tid]:
                            templates_by_id[tid][k] = v
            else:
                # Discovered a standalone HTML template without a companion JSON file
                t_id = (html_meta and html_meta.get("id")) or tid
                t_name = (html_meta and html_meta.get("name")) or tid.replace("-", " ").replace("_", " ").title()
                t_cat = (html_meta and html_meta.get("category")) or "Modern"
                t_desc = (html_meta and html_meta.get("desc")) or "Dynamic modular resume template."
                t_tags = (html_meta and html_meta.get("tags")) or ["modern", "modular"]

                templates_by_id[t_id] = {
                    "id": t_id,
                    "name": t_name,
                    "category": t_cat,
                    "tags": t_tags,
                    "desc": t_desc,
                    "thumbnail": "",
                    "premium": False,
                    "enabled": True,
                    "style": {
                        "fontFamily": "Inter, sans-serif",
                        "fontSize": "10pt",
                        "primaryColor": "#2563eb",
                        "textColor": "#1e293b",
                        "lineHeight": "1.5",
                        "margins": "18mm",
                    },
                    "sections": [
                        "summary",
                        "experience",
                        "skills",
                        "education",
                        "projects",
                        "certifications",
                        "languages",
                    ],
                    "defaultOrder": [
                        "summary",
                        "experience",
                        "skills",
                        "education",
                        "projects",
                        "certifications",
                        "languages",
                    ],
                    "_file": f"{t_id}.json",
                    "_html_file": filepath.name,
                    "_has_html": True,
                }
        except OSError as e:
            print(f"[template_service] Skipped reading HTML {filepath.name}: {e}")

    # A template is only considered "present" when it has an HTML presentation
    # file (the disk). A bare .json provides metadata for a companion .html but
    # never registers a template on its own — so removing a template's .html
    # file removes it from the registry automatically, exactly as required.
    return [t for t in templates_by_id.values() if t.get("_has_html")]


def reload():
    """Reload templates from disk and record the directory fingerprint."""
    global _cache, _fingerprint
    _cache = _load_all()
    _fingerprint = _dir_fingerprint()
    print(f"[template_service] Loaded {len(_cache)} template(s): {[t['id'] for t in _cache]}")


def get_all() -> List[Dict[str, Any]]:
    """Return all loaded templates.

    Lazily re-scans the templates directory whenever its filesystem
    fingerprint changes, so newly-added or newly-removed template files are
    picked up on the very next call — no restart or manual reload required.
    """
    global _cache
    if not _cache or _template_store_changed():
        reload()
    return _cache


def get_by_id(template_id: str) -> Optional[Dict[str, Any]]:
    """Return a single template by its id, or None."""
    for t in get_all():
        if t["id"] == template_id:
            return t
    return None


def get_ids() -> List[str]:
    """Return just the template id strings."""
    return [t["id"] for t in get_all()]


def get_public() -> List[Dict[str, Any]]:
    """Return public enabled templates sorted by order."""
    templates = [t for t in get_all() if t.get("enabled", True)]
    return sorted(templates, key=lambda t: t.get("order", 999))


def get_raw_html(template_id: str) -> Optional[str]:
    """Return the raw HTML template presentation file for a given template ID."""
    t = get_by_id(template_id)
    html_file = (t and t.get("_html_file")) or f"{template_id}.html"
    filepath = TEMPLATES_DIR / html_file
    if filepath.exists():
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read()
    return None


_URL_RE = re.compile(r"^https?://", re.IGNORECASE)


def _normalize_url(url):
    u = (url or "").strip()
    return u if _URL_RE.match(u) else "https://" + u


def _profile_handle(url):
    u = re.sub(r"^[a-z][a-z0-9+.\-]*://", "", (url or "").strip(), flags=re.IGNORECASE)
    u = re.sub(r"^www\.", "", u, flags=re.IGNORECASE)
    u = re.sub(r"[?#].*$", "", u).rstrip("/")
    if not u:
        return "@"
    parts = [seg for seg in u.split("/") if seg]
    if len(parts) > 1:
        return "@" + parts[-1]
    host = parts[0].split(".")
    return "@" + (host[-2] if len(host) >= 2 else host[0])


def _tel_href(phone):
    s = (phone or "").strip()
    if not s:
        return ""
    return ("+" if s.startswith("+") else "") + re.sub(r"\D", "", s)


_INLINE_HELPERS = {
    "handle": _profile_handle,
    "url": _normalize_url,
    "phone": _tel_href,
}

def render_template_html(template_id: str, resume_data: Dict[str, Any]) -> str:
    """
    Render HTML template with dynamic resume data placeholders.
    Supports Mustache / Handlebars placeholder tags:
      - {{personal.fullName}}, {{summary}}, etc.
      - {{#if condition}}...{{/if}}
      - {{#each array}}...{{/each}}
    """
    raw_html = get_raw_html(template_id)
    if not raw_html:
        # Fallback to default classic layout if specific HTML template is not found
        raw_html = get_raw_html("classic") or "<article class='resume-sheet'><h1>{{personal.fullName}}</h1><p>{{summary}}</p></article>"

    # Helper to HTML-escape injected values (kept in sync with esc() in the JS).
    def _esc(value: Any) -> str:
        txt = str(value) if value is not None else ""
        return txt.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    def _get_val(data: Any, path: str) -> Any:
        parts = path.strip().split(".")
        curr = data
        for p in parts:
            if not p:
                continue
            if isinstance(curr, dict) and p in curr:
                curr = curr[p]
            else:
                return None
        return curr

    def _match_block(text: str, from_idx: int, kind: str):
        """Find the matching {{/kind}} for a {{#kind ...}} opened at from_idx.

        Tracks nesting depth so arbitrarily nested blocks of the same kind
        resolve correctly. Returns (body_text, index_after_closing_tag).
        """
        opener_prefix = "#" + kind
        closer = "/" + kind
        depth = 0
        pos = from_idx
        n = len(text)
        while pos < n:
            ob = text.find("{{", pos)
            if ob == -1:
                break
            cb = text.find("}}", ob + 2)
            if cb == -1:
                break
            tag = text[ob + 2 : cb].strip()
            if tag.startswith(opener_prefix):
                depth += 1
            elif tag == closer:
                if depth == 0:
                    return (text[from_idx:ob], cb + 2)
                depth -= 1
            pos = cb + 2
        return (text[from_idx:n], n)

    def _render_block(template: str, data: Any) -> str:
        """Recursive tokenizer: fills {{path}}, {{this}}, {{#if}}/{{#each}}."""
        out: List[str] = []
        i = 0
        n = len(template)
        while i < n:
            ob = template.find("{{", i)
            if ob == -1:
                out.append(template[i:])
                break
            out.append(template[i:ob])
            cb = template.find("}}", ob + 2)
            if cb == -1:
                out.append(template[ob:])
                break
            tag = template[ob + 2 : cb].strip()
            i = cb + 2

            if tag.startswith("#each "):
                path = tag[6:].strip()
                body, next_i = _match_block(template, i, "each")
                items = _get_val(data, path)
                if isinstance(items, list):
                    for item in items:
                        if isinstance(item, str):
                            out.append(body.replace("{{this}}", _esc(item)))
                        elif isinstance(item, dict):
                            out.append(_render_block(body, item))
                i = next_i
            elif tag.startswith("#if "):
                path = tag[4:].strip()
                body, next_i = _match_block(template, i, "if")
                val = _get_val(data, path)
                truthy = bool(len(val)) if isinstance(val, list) else bool(val)
                if truthy:
                    out.append(_render_block(body, data))
                i = next_i
            else:
                helper = re.match(r"^([A-Za-z_$][\w$]*)\s+(.+)$", tag)
                if helper and helper.group(1) in _INLINE_HELPERS:
                    arg = _get_val(data, helper.group(2).strip())
                    if arg is not None:
                        out.append(_esc(_INLINE_HELPERS[helper.group(1)](arg)))
                else:
                    val = _get_val(data, tag)
                    if val is not None:
                        out.append(_esc(val))
        return "".join(out)

    output = raw_html

    # Remove template metadata comment header if present
    output = re.sub(r"<!--\s*@template:.*?-->\s*", "", output, flags=re.DOTALL)

    # Recursively inject the resume payload into the standardized placeholders
    return _render_block(output, resume_data)


def save(template_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Save updates to template JSON file."""
    current = get_by_id(template_id)
    if not current:
        return None
    filename = current.get("_file", f"{template_id}.json")
    filepath = TEMPLATES_DIR / filename

    merged = {k: v for k, v in current.items() if not k.startswith("_")}
    for key, value in updates.items():
        if key == "style" and isinstance(value, dict) and isinstance(merged.get("style"), dict):
            merged["style"] = {**merged["style"], **value}
        else:
            merged[key] = value

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(merged, f, indent=2, ensure_ascii=False)
    reload()
    return get_by_id(template_id)


def reorder(ordered_ids: List[str]) -> None:
    """Sets order on templates based on index."""
    for index, template_id in enumerate(ordered_ids):
        save(template_id, {"order": index})
