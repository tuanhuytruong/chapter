#!/usr/bin/env bash
# update.sh — Chapter app deployment helper (PM2)
# Run on the server after `git clone` / first time, and on every update.
set -euo pipefail

# This script is release-folder local. Run it from /opt/chapter or /opt/chapter-dev;
# the sibling .env.local selects the branch, PM2 process, port, and APP_ENV.
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

if [ ! -f .env.local ]; then
  echo "Missing $APP_DIR/.env.local" >&2
  exit 1
fi
set -a; source .env.local; set +a

APP_NAME="${CHAPTER_PM2_NAME:?CHAPTER_PM2_NAME must be set in .env.local}"
BRANCH="${CHAPTER_BRANCH:?CHAPTER_BRANCH must be set in .env.local}"
HEALTH_PORT="${PORT:?PORT must be set in .env.local}"
APP_ENV="${APP_ENV:?APP_ENV must be set in .env.local}"
if [ "$APP_ENV" != "prd" ] && [ "$APP_ENV" != "dev" ]; then
  echo "APP_ENV must be prd or dev" >&2
  exit 1
fi
if [ "$APP_NAME" = "chapter-prd" ] && [ "$APP_ENV" != "prd" ]; then
  echo "chapter-prd must use APP_ENV=prd" >&2
  exit 1
fi
if [ "$APP_NAME" = "chapter-dev" ] && [ "$APP_ENV" != "dev" ]; then
  echo "chapter-dev must use APP_ENV=dev" >&2
  exit 1
fi
# Time allowed for a restarted Node process to finish schema/bootstrap work and
# bind its HTTP listener. Override for unusually slow hosts if necessary.
HEALTH_RETRIES="${HEALTH_RETRIES:-20}"
HEALTH_RETRY_DELAY_SECONDS="${HEALTH_RETRY_DELAY_SECONDS:-1}"
# Non-interactive SSH shells may not include npm's user-global bin directory.
PM2_BIN="${PM2_BIN:-$(command -v pm2 || true)}"
if [ -z "$PM2_BIN" ] && [ -x "$HOME/.npm-global/bin/pm2" ]; then PM2_BIN="$HOME/.npm-global/bin/pm2"; fi
if [ -z "$PM2_BIN" ] && [ -x "$HOME/.npm-global/node_modules/pm2/bin/pm2" ]; then PM2_BIN="$HOME/.npm-global/node_modules/pm2/bin/pm2"; fi
if [ -z "$PM2_BIN" ]; then
  echo "pm2 is not installed or not on PATH" >&2
  exit 1
fi

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
if "$PM2_BIN" describe "$APP_NAME" > /dev/null 2>&1; then
  "$PM2_BIN" reload ecosystem.config.cjs --only "$APP_NAME" --env production --update-env
else
  "$PM2_BIN" start ecosystem.config.cjs --env production
fi
"$PM2_BIN" save

APP_PID="$("$PM2_BIN" pid "$APP_NAME" | tr -d '[:space:]')"
if [ -z "$APP_PID" ] || [ "$APP_PID" = "0" ]; then
  echo "PM2 did not report a live process for $APP_NAME" >&2
  exit 1
fi
echo "PM2 process ready (pid $APP_PID)"

echo "==> Done. Status:"
"$PM2_BIN" status "$APP_NAME"
echo ""
echo "Schema check:"
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not configured; cannot verify core schema" >&2
  exit 1
fi
MISSING_RELATIONS="$(psql "$DATABASE_URL" -Atqc "SELECT string_agg(name, ', ') FROM unnest(ARRAY['review_cards','weekly_reading_goals','reading_lens_analyses','story_thread_analyses','story_state_snapshots','podcasts','subscriptions','usage_events','membership_prompt_state','monthly_reviews','ask_reading_answers']) AS name WHERE to_regclass('chapter.' || name) IS NULL")"
if [ -n "$MISSING_RELATIONS" ]; then
  echo "Missing core relation(s): $MISSING_RELATIONS" >&2
  exit 1
fi
echo "Core relations present: chapter.review_cards, chapter.weekly_reading_goals, chapter.reading_lens_analyses, chapter.story_thread_analyses, chapter.story_state_snapshots, chapter.podcasts, chapter.subscriptions, chapter.usage_events, chapter.membership_prompt_state, chapter.monthly_reviews, chapter.ask_reading_answers"
echo ""
echo "Health check:"
# PORT is release-folder local and loaded from .env.local above, so the health
# probe always targets the same listener that this process starts.
HEALTH_PORT="${HEALTH_PORT:-$PORT}"
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
