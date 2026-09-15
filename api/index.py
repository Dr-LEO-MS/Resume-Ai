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

try:
    from a2wsgi import ASGIMiddleware
except Exception as _e:  # noqa: BLE001
    print("a2wsgi import failed:", _e)
    ASGIMiddleware = None

from main import app as fastapi_app

if ASGIMiddleware is not None:
    application = ASGIMiddleware(fastapi_app)
else:
    application = fastapi_app
