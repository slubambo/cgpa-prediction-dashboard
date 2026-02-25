# ============================================================
#  CGPA Prediction Dashboard — Single-image Docker build
#  Serves React frontend (nginx) + FastAPI backend (uvicorn)
# ============================================================

# ---------- Stage 1: Build the React frontend ----------
FROM node:18-alpine AS frontend-build

WORKDIR /build

# Install deps first (cacheable layer)
COPY cgpa-ui/package.json cgpa-ui/package-lock.json* ./
RUN npm ci --prefer-offline || npm install

# Copy source and build
COPY cgpa-ui/ ./

# At build time the app just needs to know the API lives at the same origin.
# Empty string = same-origin requests (works for any deployment).
ARG REACT_APP_API_BASE=""
ENV REACT_APP_API_BASE=${REACT_APP_API_BASE}

RUN npm run build


# ---------- Stage 2: Production image ----------
FROM python:3.11-slim

# Install nginx, curl (healthcheck), and envsubst (from gettext)
RUN apt-get update && \
    apt-get install -y --no-install-recommends nginx gettext-base curl && \
    rm -rf /var/lib/apt/lists/*

# --- Python / FastAPI backend ---
WORKDIR /app/api

COPY api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY api/ .

# Model + metadata live at /app (one level above api/)
COPY final_best_cgpa_model.pkl /app/final_best_cgpa_model.pkl
COPY metadata.json             /app/metadata.json

# --- Nginx + frontend static files ---
# Copy built React app into nginx html root
COPY --from=frontend-build /build/build /usr/share/nginx/html

# Copy nginx config template
COPY nginx.conf.template /etc/nginx/conf.d/default.conf.template

# Remove default nginx site
RUN rm -f /etc/nginx/sites-enabled/default /etc/nginx/conf.d/default.conf

# --- Entrypoint ---
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Configurable at runtime — works on Railway, Render, Fly.io, etc.
ENV PORT=3000
ENV API_WORKERS=2

EXPOSE ${PORT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -sf http://localhost:${PORT}/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
