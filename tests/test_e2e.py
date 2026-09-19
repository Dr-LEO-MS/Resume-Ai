import json
import os
import sys
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
import main
from api.security_tokens import (
    generate_resume_token,
    decrypt_resume_token,
    validate_resume_token,
)
from api.template_service import (
    get_all,
    get_by_id,
    get_raw_html,
    render_template_html,
    reload as reload_templates,
)

sample_resume = {
    "personal": {
        "fullName": "Subhash M",
        "title": "Python Developer",
        "email": "subhash@example.com",
        "phone": "+91 90000 00000",
        "location": "Chennai, India",
        "linkedin": "https://www.linkedin.com/in/subhash-m",
        "github": "github.com/subhash",
        "website": "https://example.com/users/name/portfolio/index.html",
    },
    "summary": "Experienced engineer with a track record of high scalability systems.",
    "experience": [
        {
            "id": "e1",
            "role": "Senior Developer",
            "company": "Tech Corp",
            "start": "2021",
            "end": "Present",
            "current": True,
            "bullets": ["Engineered core microservices.", "Reduced API latency by 40%."],
        }
    ],
    "skills": {
        "technical": ["Python", "FastAPI", "PostgreSQL"],
        "tools": ["Docker", "Git", "Kubernetes"],
        "soft": ["Leadership", "Mentorship"],
    },
    "education": [
        {
            "id": "ed1",
            "degree": "B.Tech",
            "field": "Computer Science",
            "school": "Anna University",
            "start": "2016",
            "end": "2020",
            "gpa": "3.9",
        }
    ],
    "projects": [{"name": "AI Resume Engine", "role": "Architect", "link": "https://github.com/subhash/resume-engine"}],
    "certifications": [{"name": "AWS Certified Solutions Architect", "issuer": "Amazon", "date": "2023"}],
    "languages": [{"name": "English", "level": "Fluent"}, {"name": "Tamil", "level": "Native"}],
}


def test_pages_and_routes():
    with TestClient(main.app) as c:
        for path in ("/", "/login", "/builder", "/dashboard"):
            res = c.get(path)
            assert res.status_code == 200


def test_security_tokens_crypto():
    # 1. Generation and Decryption
    resume_id = "test-resume-uuid-1234"
    owner_id = "user-999"
    token = generate_resume_token(
        resume_id=resume_id,
        owner_id=owner_id,
        permissions=["read", "write", "export"],
        expires_in_seconds=3600,
        metadata={"template": "modern"},
    )
    assert isinstance(token, str)
    assert len(token) > 60

    payload = decrypt_resume_token(token)
    assert payload["rid"] == resume_id
    assert payload["oid"] == owner_id
    assert "read" in payload["perms"]
    assert payload["meta"]["template"] == "modern"

    # 2. Validation wrapper
    is_valid, validated_payload, err = validate_resume_token(token, required_permission="read", expected_resume_id=resume_id)
    assert is_valid is True
    assert validated_payload is not None
    assert err is None

    # 3. Missing permission test
    is_valid_admin, _, err_perm = validate_resume_token(token, required_permission="admin")
    assert is_valid_admin is False
    assert "lacks required permission" in err_perm

    # 4. Tamper prevention test
    tampered_bytes = bytearray(token.encode("utf-8"))
    tampered_bytes[20] = ord("A") if chr(tampered_bytes[20]) != "A" else ord("B")
    tampered_token = tampered_bytes.decode("utf-8")
    with pytest.raises(ValueError):
        decrypt_resume_token(tampered_token)

    # 5. Expired token test
    expired_token = generate_resume_token(
        resume_id=resume_id,
        expires_in_seconds=-10,  # expired 10 seconds ago
    )
    with pytest.raises(ValueError, match="expired"):
        decrypt_resume_token(expired_token)


def test_template_discovery_and_rendering():
    reload_templates()
    templates = get_all()
    assert len(templates) >= 3

    template_ids = [t["id"] for t in templates]
    assert "classic" in template_ids
    assert "modern" in template_ids
    assert "minimal" in template_ids

    # Test raw HTML loading
    classic_html = get_raw_html("classic")
    assert classic_html is not None
    assert "{{personal.fullName}}" in classic_html

    # Test server-side dynamic rendering
    rendered = render_template_html("classic", sample_resume)
    assert "Subhash M" in rendered
    assert "Python Developer" in rendered
    assert "Tech Corp" in rendered
    assert "Anna University" in rendered
    assert "{{personal.fullName}}" not in rendered  # Placeholders must be populated


def test_api_template_endpoints():
    with TestClient(main.app) as c:
        # 1. List templates
        res = c.get("/api/templates")
        assert res.status_code == 200
        templates = res.json()
        assert len(templates) >= 3

        # 2. Get single template metadata
        res = c.get("/api/templates/classic")
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == "classic"

        # 3. Get raw template HTML
        res = c.get("/api/templates/classic/raw")
        assert res.status_code == 200
        assert "resume-sheet" in res.text

        # 4. Render template API
        res = c.post("/api/templates/modern/render", json={"resume": sample_resume})
        assert res.status_code == 200
        rendered_json = res.json()
        assert "html" in rendered_json
        assert "Subhash M" in rendered_json["html"]

        # 5. Reload templates endpoint
        res = c.post("/api/templates/reload")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"


def test_encrypted_token_resume_endpoints():
    with TestClient(main.app) as c:
        import uuid
        email = f"tokenuser_{uuid.uuid4().hex[:8]}@example.com"
        reg_res = c.post("/api/auth/register", json={"email": email, "password": "StrongPassword123!", "full_name": "Test Owner"})
        assert reg_res.status_code == 201
        auth_token = reg_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {auth_token}"}

        # 1. Create a resume
        create_res = c.post(
            "/api/resumes",
            json={"name": "Subhash Portfolio", "template": "obsidian", "content": sample_resume},
            headers=headers,
        )
        assert create_res.status_code == 201
        resume_id = create_res.json()["id"]

        # 2. Generate encrypted token
        token_res = c.get(f"/api/resumes/{resume_id}/token?permissions=read,write&expires_in_days=7", headers=headers)
        assert token_res.status_code == 200
        sec_token = token_res.json()["token"]
        assert len(sec_token) > 60

        # 3. Retrieve resume securely via encrypted token alone (zero auth headers)
        secure_get_res = c.get(f"/api/resumes/secure/{sec_token}")
        assert secure_get_res.status_code == 200
        data = secure_get_res.json()
        assert data["resume"]["id"] == resume_id
        assert data["resume"]["content"]["personal"]["fullName"] == "Subhash M"

        # 4. Update resume securely via encrypted token with write permission
        updated_resume = {**sample_resume, "personal": {**sample_resume["personal"], "fullName": "Subhash M (Updated)"}}
        secure_put_res = c.put(
            f"/api/resumes/secure/{sec_token}",
            json={"name": "Subhash Portfolio Updated", "template": "obsidian", "content": updated_resume},
        )
        assert secure_put_res.status_code == 200
        assert secure_put_res.json()["content"]["personal"]["fullName"] == "Subhash M (Updated)"


def test_export_endpoints_and_a4_rendering():
    with TestClient(main.app) as c:
        full_resume = {
            **sample_resume,
            "sectionOrder": ["summary", "experience", "education", "skills", "projects", "certifications", "languages", "power_statement", "hobbies", "references", "awards", "training"],
            "power_statement": "Proven software engineer with high impact delivery.",
            "hobbies": ["Open Source", "Chess"],
            "references": [{"name": "Jane Doe", "title": "Lead", "company": "Acme", "contact": "jane@acme.com"}],
            "awards": [{"title": "Innovator Award", "issuer": "Tech Corp", "date": "2024", "description": "Top performer"}],
            "training": [{"title": "AWS Cloud Architecture", "issuer": "AWS", "date": "2023"}],
        }

        # Test DOCX export with full sections
        r = c.post("/api/export/docx", json={"resume": full_resume})
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        assert len(r.content) > 1000

        # Test share-link
        r = c.post("/api/export/share-link", json={"resume": full_resume})
        assert r.status_code == 200
        assert "url" in r.json()

        # Test HTML rendering for A4 pagination structure
        from api.routers.export_router import render_html
        html = render_html(full_resume)
        assert "size: A4" in html
        assert "page-break-inside: avoid" in html
        assert "Subhash M" in html
        assert "Python Developer" in html


def test_account_management_endpoints():
    with TestClient(main.app) as c:
        import uuid
        email = f"acct_test_{uuid.uuid4().hex[:8]}@example.com"
        reg_res = c.post(
            "/api/auth/register",
            json={"email": email, "password": "StrongPassword123!", "full_name": "Account Tester"}
        )
        assert reg_res.status_code == 201
        token = reg_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Test me/extended
        ext_res = c.get("/api/auth/me/extended", headers=headers)
        assert ext_res.status_code == 200
        ext_data = ext_res.json()
        assert ext_data["email"] == email
        assert ext_data["full_name"] == "Account Tester"
        assert ext_data["has_set_password"] is True
        assert ext_data["timezone"] == "UTC"

        # 2. Test update-profile
        up_res = c.put(
            "/api/auth/update-profile",
            json={
                "full_name": "Account Tester Updated",
                "bio": "Software developer & designer.",
                "profile_slug": f"test-user-{uuid.uuid4().hex[:6]}",
                "is_profile_public": True,
            },
            headers=headers,
        )
        assert up_res.status_code == 200
        up_data = up_res.json()
        assert up_data["full_name"] == "Account Tester Updated"
        assert up_data["bio"] == "Software developer & designer."
        assert up_data["is_profile_public"] is True

        # 3. Test update-preferences
        pref_res = c.put(
            "/api/auth/update-preferences",
            json={
                "timezone": "America/New_York",
                "date_format": "YYYY-MM-DD",
                "locale": "en",
                "notifications_email": False,
                "notifications_product": True,
            },
            headers=headers,
        )
        assert pref_res.status_code == 200
        pref_data = pref_res.json()
        assert pref_data["timezone"] == "America/New_York"
        assert pref_data["date_format"] == "YYYY-MM-DD"
        assert pref_data["notifications_email"] is False

        # 3b. Test avatar upload and removal
        import io
        from PIL import Image
        img_byte_arr = io.BytesIO()
        Image.new('RGB', (100, 100), color='blue').save(img_byte_arr, format='JPEG')
        img_bytes = img_byte_arr.getvalue()

        avatar_res = c.post(
            "/api/auth/upload-avatar",
            files={"file": ("avatar.jpg", img_bytes, "image/jpeg")},
            headers=headers,
        )
        assert avatar_res.status_code == 200
        avatar_url = avatar_res.json()["url"]
        assert "/static/uploads/avatars/" in avatar_url

        # Check me/extended has the avatar url
        me_res = c.get("/api/auth/me/extended", headers=headers)
        assert me_res.json()["profile_picture_url"] == avatar_url

        # Remove avatar
        rem_res = c.delete("/api/auth/remove-avatar", headers=headers)
        assert rem_res.status_code == 200
        me_after_rem = c.get("/api/auth/me/extended", headers=headers)
        assert me_after_rem.json()["profile_picture_url"] is None

        # 3c. Test update-email
        new_email_addr = f"new_email_{uuid.uuid4().hex[:8]}@example.com"
        email_up_res = c.put(
            "/api/auth/update-email",
            json={"new_email": new_email_addr, "current_password": "StrongPassword123!"},
            headers=headers,
        )
        assert email_up_res.status_code == 200
        email_token = email_up_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {email_token}"}
        email = new_email_addr

        # 4. Test change-password
        pw_res = c.put(
            "/api/auth/change-password",
            json={"current_password": "StrongPassword123!", "new_password": "NewStrongP@ssw0rd99!"},
            headers=headers,
        )
        assert pw_res.status_code == 200

        # Login with old password should fail
        login_fail = c.post("/api/auth/login", json={"email": email, "password": "StrongPassword123!"})
        assert login_fail.status_code == 401

        # Login with new password should succeed
        login_ok = c.post("/api/auth/login", json={"email": email, "password": "NewStrongP@ssw0rd99!"})
        assert login_ok.status_code == 200
        new_token = login_ok.json()["access_token"]
        new_headers = {"Authorization": f"Bearer {new_token}"}

        # 5. Test sign-out-all
        so_res = c.post("/api/auth/sign-out-all", headers=new_headers)
        assert so_res.status_code == 200
        active_token = so_res.json()["access_token"]
        active_headers = {"Authorization": f"Bearer {active_token}"}

        # Previous token should now be invalidated
        stale_res = c.get("/api/auth/me", headers=new_headers)
        assert stale_res.status_code == 401

        # New token from sign-out-all is valid
        valid_res = c.get("/api/auth/me", headers=active_headers)
        assert valid_res.status_code == 200

        # 6. Test delete-account
        del_res = c.post(
            "/api/auth/delete-account",
            json={"confirmation": "DELETE", "current_password": "NewStrongP@ssw0rd99!"},
            headers=active_headers,
        )
        assert del_res.status_code == 200

        # Login to deleted account should fail
        del_login = c.post("/api/auth/login", json={"email": email, "password": "NewStrongP@ssw0rd99!"})
        assert del_login.status_code == 401


def test_account_management_legacy_user_with_nulls():
    """Verify that a legacy user row with NULL in new columns loads /me/extended cleanly."""
    from api.database import SessionLocal
    from api.models import User
    from api import auth
    import uuid

    db = SessionLocal()
    user_id = str(uuid.uuid4())
    legacy_email = f"legacy_{uuid.uuid4().hex[:8]}@example.com"
    legacy_user = User(
        id=user_id,
        email=legacy_email,
        hashed_password=auth.hash_password("LegacyStrongPass123!"),
        full_name="Legacy User",
        bio=None,
        profile_picture_url=None,
        profile_slug=None,
        is_profile_public=False,
        timezone=None,
        date_format=None,
        locale=None,
        notifications_email=None,
        notifications_product=None,
        has_set_password=None,
        token_version=None,
    )
    db.add(legacy_user)
    db.commit()
    db.close()

    with TestClient(main.app) as c:
        # Generate token for legacy user
        token = auth.create_access_token(user_id)
        headers = {"Authorization": f"Bearer {token}"}

        res = c.get("/api/auth/me/extended", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["email"] == legacy_email
        assert data["full_name"] == "Legacy User"




def test_pdf_export_robust_handling():
    """The PDF endpoint must never 500.

    It either returns a valid, small, link-annotated vector PDF (when the
    WeasyPrint system libraries are present) or a clean, helpful RFC error
    (403 disabled / 501 renderer unavailable). Both are graceful outcomes the
    client turns into a browser print fallback.
    """
    with TestClient(main.app) as c:
        r = c.post("/api/export/pdf", json={"resume": sample_resume})

        if r.status_code == 200:
            # Valid PDF: %PDF header, reasonable email-ready size, real link
            # annotations (WeasyPrint emits /URI for <a>), correct mimetype + name.
            assert r.headers["content-type"] == "application/pdf"
            assert r.content[:5] == b"%PDF-"
            assert len(r.content) < 2_500_000
            assert r.content.count(b"/URI") > 0
            assert 'Content-Disposition' in r.headers
            assert "attachment" in r.headers["content-disposition"]
            assert "_Resume.pdf" in r.headers["content-disposition"]
        else:
            # Graceful, structured failure (403 disabled or 501 deps missing) —
            # never a bare 500 / HTML error page.
            assert r.status_code in (403, 501)
            body = r.json()
            assert isinstance(body.get("detail"), str) and body["detail"].strip()


def test_cover_letter_templates_and_export():
    sample_cover_letter = {
        "docType": "cover_letter",
        "template": "cl-modern",
        "personal": {
            "fullName": "Jane Applicant",
            "title": "Senior Product Designer",
            "email": "jane@example.com",
            "phone": "+1 555-0199",
            "location": "San Francisco, CA",
            "linkedin": "linkedin.com/in/jane",
            "website": "https://janedesign.com",
        },
        "coverLetter": {
            "companyName": "Acme Global",
            "hiringManager": "Alex Johnson",
            "companyAddress": "500 Market St, Suite 200, San Francisco, CA",
            "date": "September 12, 2026",
            "salutation": "Dear Alex Johnson,",
            "body": "I am thrilled to apply for the Senior Product Designer role at Acme Global.\n\nWith over 7 years of experience in product design, I led cross-functional teams to redesign core web and mobile apps resulting in a 40% increase in user retention.\n\nI look forward to contributing my design leadership to Acme Global.",
            "keyQualifications": ["7+ years of product design leadership", "Proven design systems experience"],
            "signOff": "Best regards,",
            "signature": "Jane Applicant",
        }
    }

    with TestClient(main.app) as c:
        # 1. Test template discovery lists cover letter templates
        res = c.get("/api/templates")
        assert res.status_code == 200
        tpls = res.json()
        cl_tpl_ids = [t["id"] for t in tpls if t["id"].startswith("cl-")]
        assert len(cl_tpl_ids) >= 4
        assert "cl-modern" in cl_tpl_ids
        assert "cl-classic" in cl_tpl_ids
        assert "cl-creative" in cl_tpl_ids
        assert "cl-executive" in cl_tpl_ids

        # 2. Test rendering cover letter templates
        for tpl_id in ("cl-modern", "cl-classic", "cl-creative", "cl-executive"):
            res_render = c.post(f"/api/templates/{tpl_id}/render", json={"resume": {**sample_cover_letter, "template": tpl_id}})
            assert res_render.status_code == 200
            html_out = res_render.json()["html"]
            assert "Jane Applicant" in html_out
            assert "Acme Global" in html_out
            assert "Alex Johnson" in html_out

        # 3. Test DOCX export for cover letter
        res_docx = c.post("/api/export/docx", json={"resume": sample_cover_letter})
        assert res_docx.status_code == 200
        assert res_docx.headers["content-type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        assert len(res_docx.content) > 1000

        # 4. Test AI generation for kind="cover_letter"
        import uuid
        fresh_email = f"cl_ai_{uuid.uuid4().hex[:8]}@example.com"
        reg_res = c.post("/api/auth/register", json={"email": fresh_email, "password": "StrongPassword123!", "full_name": "AI Tester"})
        ai_headers = {"Authorization": f"Bearer {reg_res.json()['access_token']}"}

        res_ai = c.post("/api/ai/generate", json={
            "kind": "cover_letter",
            "job_title": "Product Designer",
            "context": {"companyName": "Acme Corp", "hiringManager": "Alex"}
        }, headers=ai_headers)
        assert res_ai.status_code == 200
        ai_data = res_ai.json()
        assert ai_data["kind"] == "cover_letter"
        assert len(ai_data["result"]) > 100
        assert "Product Designer" in ai_data["result"]


def test_pdf_filename_helper():
    from api.routers.export_router import _pdf_filename

    assert _pdf_filename({"personal": {"fullName": "Subhash M"}}) == "Subhash_M_Resume.pdf"
    assert _pdf_filename({"personal": {"fullName": 'Jo:e <Bad> "Name"?'}}) == "Joe_Bad_Name_Resume.pdf"
    assert _pdf_filename({"personal": {}}) == "Resume_Resume.pdf"


def test_download_all_resumes_zip():
    """GET /api/resumes/download-all returns ONE ZIP containing one document per
    saved item (a PDF when WeasyPrint is available, otherwise a Word .docx),
    de-dupes identically named entries, and fails gracefully when empty."""
    import io
    import uuid
    import zipfile

    with TestClient(main.app) as c:
        email = f"zipuser_{uuid.uuid4().hex[:8]}@example.com"
        reg = c.post(
            "/api/auth/register",
            json={"email": email, "password": "StrongPassword123!", "full_name": "Zip Tester"},
        )
        assert reg.status_code == 201
        headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

        # 1. Nothing saved yet -> clean 404 (never a 500 / traceback).
        empty = c.get("/api/resumes/download-all", headers=headers)
        assert empty.status_code == 404
        assert isinstance(empty.json().get("detail"), str)

        # 2. A free plan allows one resume + one cover letter. Both carry the SAME
        #    person name, so the ZIP entry de-duplication path is exercised too.
        resume = c.post(
            "/api/resumes",
            json={"name": "Alpha Resume", "template": "classic", "content": sample_resume},
            headers=headers,
        )
        assert resume.status_code == 201
        cover_letter = c.post(
            "/api/resumes",
            json={
                "name": "Beta Cover Letter",
                "doc_type": "cover_letter",
                "template": "cl-modern",
                "content": sample_resume,
            },
            headers=headers,
        )
        assert cover_letter.status_code == 201

        res = c.get("/api/resumes/download-all", headers=headers)
        assert res.status_code == 200
        assert res.headers["content-type"] == "application/zip"
        assert "attachment" in res.headers["content-disposition"]
        assert "resumes.zip" in res.headers["content-disposition"]

        zf = zipfile.ZipFile(io.BytesIO(res.content))
        assert zf.testzip() is None  # archive is not corrupt
        names = zf.namelist()
        assert len(names) == 2        # exactly one document per saved item
        assert len(set(names)) == 2   # identical person names must not collide
        for name in names:
            data = zf.read(name)
            assert len(data) > 500
            if name.lower().endswith(".pdf"):
                assert data[:5] == b"%PDF-"
            else:
                # Word .docx is itself a ZIP container (PK\x03\x04).
                assert name.lower().endswith(".docx")
                assert data[:2] == b"PK"

        # 3. Filtering by doc_type returns just that type.
        only_resume = c.get("/api/resumes/download-all?doc_type=resume", headers=headers)
        assert only_resume.status_code == 200
        assert len(zipfile.ZipFile(io.BytesIO(only_resume.content)).namelist()) == 1

        # 4. Auth is required.
        assert c.get("/api/resumes/download-all").status_code in (401, 403)


def _builder_topbar_css_tier(css: str, start_marker: str, end_marker: str) -> str:
    """Slices one @media block out of styles.css (string slicing reads better
    than a regex for a stylesheet this large). Markers are the unique
    /* builder-topbar-tier-N */ comments so an unrelated same-width @media
    block (e.g. the pre-existing (max-width: 480px) grid block) can never be
    picked up by mistake."""
    tier = css.split(start_marker)[-1]
    return tier[: tier.index(end_marker)] if end_marker in tier else tier


def test_builder_topbar_survives_sub_320px_viewports():
    """Regression guard for the builder topbar below 320px.

    The bar used to break at narrow widths because the <=860px block set
    `.builder-header-container { flex-wrap: wrap }`; once the reference row's
    min-content width exceeded the viewport (~430px) the whole `.nav-actions`
    cluster fell onto its own flex line, and `.nav-segment-tabs
    { flex: 1 0 100% }` added a third — a 127px-tall bar at 320px, 141px at
    240px, 167px at 180px instead of the reference's single 72px row. Fixed
    widths (title 85px, select, 38px avatar, 30px icon buttons) plus the
    default `min-width: auto` of flex items then pushed the bar past the
    viewport edge, creating page-level horizontal scroll below ~230px.

    The fix locks the reference row with a two-line grid (grid tracks cannot
    wrap) and viewport-relative metrics, so these assertions pin the contract:
    the bar must stay one row of eight controls above the tab strip, with no
    wrapping, no clipping of tab labels and no page-level overflow.
    """
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    with open(os.path.join(root, "static", "css", "styles.css"), encoding="utf-8") as fh:
        css = fh.read()

    # 1. A hardening tier exists for each narrow breakpoint, down to the
    #    smallest practical viewport (foldable cover screens).
    for marker in (
        "@media (max-width: 480px)",
        "@media (max-width: 320px)",
        "@media (max-width: 260px)",
    ):
        assert marker in css, f"missing narrow-viewport tier {marker}"

    tier1 = _builder_topbar_css_tier(
        css, "/* builder-topbar-tier-1 */", "/* builder-topbar-tier-2 */"
    )

    # 2. The bar is a two-line grid: reference row first, view switcher second.
    container_rule = tier1.split(".site-header .builder-header-container {")[1].split("}")[0]
    assert "display: grid" in container_rule
    assert "grid-template-columns: minmax(0, 1fr) auto" in container_rule
    assert '"left actions"' in container_rule and '"tabs tabs"' in container_rule
    # ...and the bar itself must not become a scroll container, otherwise the
    # Export / user popovers would be clipped by it.
    assert "overflow" not in container_rule

    for area in ("grid-area: left", "grid-area: actions", "grid-area: tabs"):
        assert area in tier1

    # 3. Neither cluster may wrap (that is what produced the extra bar lines).
    assert tier1.count("flex-wrap: nowrap") >= 2

    # 4. Formerly fixed metrics are viewport-relative and the title can shrink
    #    and elide instead of pushing the row wider than the screen.
    assert "width: clamp(24px, 17vw, 85px)" in tier1          # was width: 85px
    assert "font-size: clamp(9px, 2.6vw, 12.8px)" in tier1    # was 12.8px fixed
    assert "width: clamp(22px, 9vw, 38px)" in tier1           # was the 38px avatar
    assert "min-width: 0" in tier1
    assert "text-overflow: ellipsis" in tier1
    assert "flex-wrap: nowrap" in tier1

    # 5. Tab labels keep their full text: they may grow to share the row but
    #    never shrink below the label, and the strip scrolls as a fallback.
    tabs_rule = tier1.split(".nav-segment-tabs .view-tab {")[1].split("}")[0]
    assert "min-width: max-content" in tabs_rule
    assert "white-space: nowrap" in tabs_rule
    tabs_strip_rule = tier1.split(".builder-header-container > .nav-segment-tabs {")[1].split("}")[0]
    assert "flex-wrap: nowrap" in tabs_strip_rule
    assert "overflow-x: auto" in tabs_strip_rule

    # 6. Popovers opened from the bar are pinned to the viewport in the
    #    <=320px tier (where the bar itself scrolls) so they are never clipped
    #    by the bar and always fit the screen they were opened on.
    tier2 = _builder_topbar_css_tier(
        css, "/* builder-topbar-tier-2 */", "/* builder-topbar-tier-3 */"
    )
    assert "#autosave-status" in tier1                        # chip stays in-row
    assert "#autosave-status:hover .autosave-text" in tier1    # hover can't reflow
    assert "overflow-x: auto" in tier2                      # scroll, never wrap
    assert "position: fixed" in tier2
    assert "max-width: none" in tier2

    # 7. The builder page still ships the eight reference controls, in the
    #    reference order, and pulls the current stylesheet build.
    with TestClient(main.app) as c:
        html = c.get("/builder").text
    order = [
        'class="logo-mark"',
        'id="doc-title-input"',
        'id="lang-select-dropdown"',
        'id="autosave-status"',
        'class="nav-actions',
        'id="import-btn"',
        'class="theme-toggle icon-btn"',
        'id="export-dropdown-toggle"',
    ]
    positions = [html.index(token) for token in order]
    assert positions == sorted(positions), "topbar controls changed order"
    assert "styles.css?v=20260917-1" in html


def test_links_section_export_and_discovery():
    """Verify that the Links section renders in HTML/PDF/DOCX exports and AI link checker."""
    from api.ai_tools import check_links
    from api.ai_service import _mock_parse_resume_text

    resume_with_links = {
        **sample_resume,
        "sectionOrder": ["summary", "experience", "education", "skills", "links"],
        "links": [
            {"id": "l1", "label": "LinkedIn : @subhash-leo", "link": "https://in.linkedin.com/in/subhash-leo"},
            {"id": "l2", "label": "Portfolio", "link": "https://subhash.dev"},
        ],
    }

    with TestClient(main.app) as c:
        # 1. DOCX export contains links
        docx_res = c.post("/api/export/docx", json={"resume": resume_with_links})
        assert docx_res.status_code == 200
        assert len(docx_res.content) > 1000

        # 2. Template rendering includes links
        for tpl in ("classic", "modern", "minimal", "bold", "executive", "obsidian", "zen"):
            r = c.post(f"/api/templates/{tpl}/render", json={"resume": {**resume_with_links, "template": tpl}})
            assert r.status_code == 200
            html = r.json()["html"]
            assert "LinkedIn : @subhash-leo" in html or "https://in.linkedin.com/in/subhash-leo" in html or "subhash-leo" in html

        # 3. AI link checking detects links in resume.links
        link_analysis = check_links(resume_with_links)
        assert any("subhash" in l.get("url", "") or "subhash" in l.get("display", "") for l in link_analysis["links"])

        # 4. Mock parser returns links array
        parsed = _mock_parse_resume_text("Some random text")
        assert "links" in parsed
        assert isinstance(parsed["links"], list)

