# Resume AI - Docker image
# NOTE: we pin python:3.12-slim and run `apt-get upgrade` at build time so
# base-image OS CVEs (reported by Docker DX / Scout on the stale digest)
# are patched on every build. Pinning a full digest would silence the
# warning for one snapshot but rot again — upgrade-on-build is the fix.
FROM python:3.12-slim AS base

# WeasyPrint needs Pango/Cairo; Pillow needs JPEG/Zlib. Missing these breaks PDF/avatar/images.
# `apt-get upgrade` patches the base image's packaged vulnerabilities.
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
        libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf-2.0-0 libpangoft2-1.0-0 \
        libcairo2 libffi-dev libjpeg62-turbo zlib1g zlib1g-dev shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8000
# Build stamp: baked into the image so /api/version reports the exact commit.
ARG BUILD_SHA=dev
ENV BUILD_SHA=${BUILD_SHA}
ARG BUILD_TIME=""
ENV BUILD_TIME=${BUILD_TIME}

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN mkdir -p static/uploads/avatars static/uploads/photos

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
