# Vercel serverless entrypoint (WSGI) for the FastAPI/ASGI app.
# a2wsgi bridges ASGI -> WSGI which is what Vercel's Python runtime serves.
import os

# Ensure the DB is initialized/migrated and uses DATABASE_URL (Postgres),
# not a local SQLite file. Idempotent against Postgres; guarded so a cold-start
# DB hiccup doesn't prevent the app from loading.
try:
    from api.database import init_db
    init_db()
except Exception as _e:  # noqa: BLE001
    print("init_db skipped:", _e)

from main import app as fastapi_app

# a2wsgi is optional - fall back to the raw ASGI app if it can't be imported.
try:
    from a2wsgi import ASGIMiddleware
except Exception as _e:  # noqa: BLE001
    print("a2wsgi import failed:", _e)
    ASGIMiddleware = None

# Vercel entrypoint.
# IMPORTANT: Vercel's Python runtime finds the handler by scanning for a plain
# top-level module attribute named `app`, `application`, or `handler`. The
# attribute MUST be assigned UNCONDITIONALLY at module scope (a bare `name = ...`
# statement). If the assignment is nested inside an `if/else` or `try/except`
# block, Vercel's static detector skips it and the build fails with:
#   "Could not find a top-level app, application, or handler in api/index.py"
# So the WSGI wrapper is built into a local first, then assigned to the
# detectible `application` name in one top-level statement.
_wsgi_app = ASGIMiddleware(fastapi_app) if ASGIMiddleware is not None else fastapi_app
application = _wsgi_app
