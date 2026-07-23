#!/usr/bin/env bash
# update.sh — Chapter app deploy on e7240ubt (PM2)
# Run on the server after `git clone` / first time, and on every update.
set -euo pipefail

APP_NAME="chapter"
APP_DIR="${CHAPTER_APP_DIR:-/opt/chapter}"
BRANCH="${BRANCH:-dev}"
PORT="${PORT:-3000}"

cd "$APP_DIR"

echo "==> Pulling $BRANCH"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "==> Installing deps"
npm install

echo "==> Building (Vite + Express bundle)"
npm run build

echo "==> Loading env"
if [ -f .env.local ]; then
  set -a; source .env.local; set +a
fi

echo "==> DB schema will be ensured automatically on server boot (ensureSchema)"

echo "==> (Re)Starting with PM2"
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  pm2 reload "$APP_NAME" --update-env
else
  pm2 start ecosystem.config.cjs --env production
fi
pm2 save

echo "==> Done. Status:"
pm2 status "$APP_NAME"
echo ""
echo "Health check:"
HEALTH_URL="http://localhost:${PORT}/health"
HEALTH_STATUS="$(curl -sS -m 5 -o /dev/null -w "%{http_code}" "$HEALTH_URL" || true)"
if [ "$HEALTH_STATUS" = "200" ]; then
  echo "GET /health -> HTTP 200"
else
  echo "GET /health -> HTTP ${HEALTH_STATUS:-000} (server not healthy)" >&2
  exit 1
fi
