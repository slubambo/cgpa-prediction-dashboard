#!/bin/sh
set -e

# Default port if not provided (works on Railway, Render, Fly.io, etc.)
export PORT="${PORT:-3000}"

echo "==> Starting CGPA Prediction Dashboard"
echo "    PORT=${PORT}"
echo "    API workers: ${API_WORKERS:-2}"

# Render nginx config from template (substitute $PORT)
envsubst '${PORT}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# Start the FastAPI backend in the background
cd /app/api
uvicorn main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers "${API_WORKERS:-2}" \
  --log-level info &

# Wait briefly for uvicorn to boot
sleep 1

echo "==> FastAPI running on :8000"
echo "==> Nginx serving on :${PORT}"

# Start nginx in the foreground (container entrypoint)
exec nginx -g "daemon off;"
