"""
google_auth.py
-------------------------------------------------------------------------
Server-side handling for "Sign in with Google" (Google Identity Services).

Flow: the browser signs the user in with the GIS button, which produces a
Google-issued ID token (a JWT). The frontend sends that token to
POST /api/auth/google, which verifies it here against Google's tokeninfo
endpoint, then finds-or-creates a local user and returns the app's own JWT.

No client secret is required because this is an ID-token (public clients)
flow, not an authorization-code flow. We still verify the token with Google
and check that `aud` matches our published GOOGLE_CLIENT_ID.

Environment:
  GOOGLE_CLIENT_ID   — the OAuth 2.0 client ID (web) the frontend button uses.
                       If unset, the Google login button is hidden.
-------------------------------------------------------------------------
"""

import os
from typing import Dict, Any

import httpx

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
# A Google account without an email cannot be "really" verified for login.
ALLOWED_ISSUERS = ("https://accounts.google.com", "accounts.google.com")


class GoogleAuthError(Exception):
    """Raised when a Google ID token cannot be trusted."""


def verify_id_token(id_token: str) -> Dict[str, Any]:
    """Validates a Google ID token and returns its verified claims.

    Raises GoogleAuthError on any failure (bad token, wrong audience,
    unverified email, network error).
    """
    if not GOOGLE_CLIENT_ID:
        raise GoogleAuthError("Google login is not configured server-side.")
    if not id_token:
        raise GoogleAuthError("Missing Google credential.")

    try:
        resp = httpx.get(
            TOKENINFO_URL,
            params={"id_token": id_token},
            timeout=10.0,
        )
        resp.raise_for_status()
        claims = resp.json()
    except Exception as exc:  # network or non-200
        raise GoogleAuthError("Could not verify Google token.") from exc

    # The token belongs to one of OUR clients (sub-fdda... IDs from Google
    # Console share the same audience/domain space, so match the exact client).
    if str(claims.get("aud")) != GOOGLE_CLIENT_ID:
        raise GoogleAuthError("Google token was not issued for this application.")
    if claims.get("email_verified") not in (True, "true"):
        raise GoogleAuthError("Google email is not verified.")
    if not claims.get("email"):
        raise GoogleAuthError("Google account has no email address.")
    if claims.get("iss") not in ALLOWED_ISSUERS:
        raise GoogleAuthError("Google token issuer is not trusted.")

    return {
        "google_id": claims["sub"],
        "email": claims["email"].lower(),
        "full_name": claims.get("name") or "",
        "picture": claims.get("picture") or "",
    }