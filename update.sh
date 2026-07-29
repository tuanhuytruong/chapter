#!/usr/bin/env bash
# update.sh — Chapter app deployment helper (PM2)
# Run on the server after `git clone` / first time, and on every update.
set -euo pipefail

APP_NAME="chapter"
APP_DIR="${CHAPTER_APP_DIR:-/opt/chapter}"
BRANCH="${BRANCH:-dev}"
# Time allowed for a restarted Node process to finish schema/bootstrap work and
# bind its HTTP listener. Override for unusually slow hosts if necessary.
HEALTH_RETRIES="${HEALTH_RETRIES:-20}"
HEALTH_RETRY_DELAY_SECONDS="${HEALTH_RETRY_DELAY_SECONDS:-1}"

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

echo "==> (Re)Starting with PM2 in production mode"
# The build is served from dist/ in production. Explicitly pass --env on BOTH
# start and reload so a previously started development process cannot keep
# Vite middleware (which rejects unapproved public hosts) or non-secure cookies.
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --only "$APP_NAME" --env production --update-env
else
  pm2 start ecosystem.config.cjs --env production
fi
pm2 save

APP_PID="$(pm2 pid "$APP_NAME" | tr -d '[:space:]')"
if [ -z "$APP_PID" ] || [ "$APP_PID" = "0" ]; then
  echo "PM2 did not report a live process for $APP_NAME" >&2
  exit 1
fi
echo "PM2 process ready (pid $APP_PID)"

echo "==> Done. Status:"
pm2 status "$APP_NAME"
echo ""
echo "Schema check:"
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not configured; cannot verify core schema" >&2
  exit 1
fi
MISSING_RELATIONS="$(psql "$DATABASE_URL" -Atqc "SELECT string_agg(name, ', ') FROM unnest(ARRAY['review_cards','weekly_reading_goals','reading_lens_analyses','story_thread_analyses','story_state_snapshots','podcasts']) AS name WHERE to_regclass('chapter.' || name) IS NULL")"
if [ -n "$MISSING_RELATIONS" ]; then
  echo "Missing core relation(s): $MISSING_RELATIONS" >&2
  exit 1
fi
echo "Core relations present: chapter.review_cards, chapter.weekly_reading_goals, chapter.reading_lens_analyses, chapter.story_thread_analyses, chapter.story_state_snapshots, chapter.podcasts"
echo ""
echo "Health check:"
# Read the production listener port from the PM2 ecosystem file. This avoids a
# shell/.env PORT value accidentally probing a different port than PM2 serves.
PM2_PORT="$(node -e "const app=require('./ecosystem.config.cjs').apps.find((item) => item.name === process.argv[1]); if (!app) process.exit(1); process.stdout.write(String(app.env_production?.PORT ?? 3000));" "$APP_NAME")"
HEALTH_PORT="${HEALTH_PORT:-$PM2_PORT}"
HEALTH_URL="http://127.0.0.1:${HEALTH_PORT}/health"
HEALTH_STATUS="000"

for attempt in $(seq 1 "$HEALTH_RETRIES"); do
  HEALTH_STATUS="$(curl -sS -m 3 -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || true)"
  if [ "$HEALTH_STATUS" = "200" ]; then
    echo "GET /health -> HTTP 200 (ready after ${attempt}/${HEALTH_RETRIES} attempt(s))"
    exit 0
  fi

  if [ "$attempt" -lt "$HEALTH_RETRIES" ]; then
    echo "GET /health -> HTTP ${HEALTH_STATUS:-000}; waiting ${HEALTH_RETRY_DELAY_SECONDS}s for startup (${attempt}/${HEALTH_RETRIES})"
    sleep "$HEALTH_RETRY_DELAY_SECONDS"
  fi
done

echo "GET /health -> HTTP ${HEALTH_STATUS:-000} after ${HEALTH_RETRIES} attempt(s) (server not healthy)" >&2
echo "Recent PM2 logs for $APP_NAME:" >&2
pm2 logs "$APP_NAME" --lines 30 --nostream >&2 || true
exit 1
