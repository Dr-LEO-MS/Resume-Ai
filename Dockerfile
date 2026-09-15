# Resume AI - Docker image
# Python 3.12-slim: well-supported wheels for all pinned deps incl. WeasyPrint/Pillow/pdfplumber.
FROM python:3.12-slim AS base

# WeasyPrint needs Pango/Cairo; Pillow needs JPEG/Zlib. Missing these breaks PDF/avatar/images.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf-2.0-0 libpangoft2-1.0-0 \
        libcairo2 libffi-dev libjpeg62-turbo zlib1g zlib1g-dev shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8000

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN mkdir -p static/uploads/avatars static/uploads/photos

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
