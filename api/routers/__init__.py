"""
api/routers/__init__.py
-------------------------------------------------------------------------
Re-exports all router instances so main.py can do a single import.
"""

from .auth_router import router as auth_router
from .resumes_router import router as resumes_router
from .ai_router import router as ai_router
from .export_router import router as export_router
from .misc_router import router as misc_router
from .templates_router import router as templates_router
from .admin_router import router as admin_router
from .upload_router import router as upload_router
from .import_router import router as import_router

__all__ = [
    "auth_router",
    "resumes_router",
    "ai_router",
    "export_router",
    "misc_router",
    "templates_router",
    "admin_router",
    "upload_router",
    "import_router",
]
