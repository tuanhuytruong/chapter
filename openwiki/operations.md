---
type: Concept
title: Chapter — Operations
description: Deployment, environment configuration, build process, PM2 management, verification scripts, and production considerations.
tags: [operations, deployment, configuration, env, scripts]
---

# Operations

## Prerequisites

- **Node.js 20+** with npm
- **PostgreSQL** (existing `dwh` database; tables go in `chapter` schema)
- **9router** instance reachable at the configured URL
- **n8n** instance (for daily cron automation)
- **Telegram bot token** from [@BotFather](https://t.me/BotFather)
- **Book files** accessible at the configured `CHAPTER_BOOKS_DIR`

## Environment configuration

All configuration is loaded from `.env.local` (auto-loaded at server start via `dotenv`). Copy `.env.example`:

```bash
cp .env.example .env.local
```

### Key variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (`postgresql://user:pass@localhost:5432/dwh`) |
| `NINE_ROUTER_URL` | Yes | 9router API endpoint (e.g. `http://localhost:20128/v1/chat/completions`) |
| `NINE_ROUTER_API_KEY` | Yes | API key for 9router |
| `NINE_ROUTER_MODEL` | No | Model name (default `n8n`) |
| `TELEGRAM_BOT_TOKEN` | Yes | Telegram bot token from BotFather |
| `TELEGRAM_BOT_USERNAME` | For linking | Bot username (needed for deep link generation) |
| `TELEGRAM_WEBHOOK_SECRET` | For linking | Secret token for webhook endpoint |
| `TELEGRAM_CHAT_ID` | For n8n | Chat ID for cron delivery |
| `CHAPTER_BOOKS_DIR` | Yes | Directory for book files (default `/opt/chapter/workspace/books`) |
| `SESSION_SECRET` | Yes | Express session signing secret |
| `ADMIN_TOKEN` | No | Reserved for administrative operations |
| `ADMIN_USERNAME` | No | Existing account that receives a deleted user's books |
| `PORT` | No | Server port (default `3000`) |
| `NODE_ENV` | No | `production` enables secure cookies |

> **Security**: `NINE_ROUTER_API_KEY`, `TELEGRAM_BOT_TOKEN`, and `SESSION_SECRET` are sensitive values. Never commit them to version control.

## Deployment

The [`update.sh`](../update.sh) script handles a full deploy:

```bash
cd /opt/chapter/workspace/chapter
./update.sh
```

It performs:
1. `git pull origin dev`
2. `npm install`
3. `npm run build`
4. Loads `.env.local`
5. Restarts via PM2 (`pm2 reload` if already running, `pm2 start` otherwise)
6. Verifies DB schema (checks for required tables)
7. Health check against `GET /health`

### Manual deployment

```bash
# Install
npm install

# Build frontend + backend
npm run build

# Start via PM2
pm2 start ecosystem.config.cjs     # first time
pm2 reload chapter                 # subsequent updates

# Start via Node directly (dev)
npm run dev
```

### PM2 configuration (`ecosystem.config.cjs`)

| Setting | Value |
|---------|-------|
| App name | `chapter` |
| Script | `dist/server.mjs` |
| Instances | 1 |
| Autorestart | true |
| Watch | false |
| Node env | `production` |

The config is CommonJS (`.cjs`) because `package.json` has `"type": "module"`.

## Build pipeline

```
npm run build
```

This runs two parallel steps:
1. **Vite build** — bundles the React frontend into `dist/` (static HTML/JS/CSS)
2. **esbuild** — bundles the Express server into `dist/server.mjs` (ESM, external packages)

In production, the server serves `dist/index.html` and static assets from `dist/assets/`.

## Verification scripts

| Script | Run command | Purpose |
|--------|-------------|---------|
| `verify-phase1.mjs` | `npm run verify:phase1` | End-to-end core reading pipeline test |
| `verify-9router.mjs` | `npm run verify:9router` | Tests LLM connectivity + response parsing |
| `verify-telegram.ts` | `tsx scripts/verify-telegram.ts` | Tests Telegram message sending |
| `verify-telegram-link.ts` | `tsx scripts/verify-telegram-link.ts` | Tests deep link token flow |
| `verify-reading-lens.ts` | `npm run verify:reading-lens` | Tests reading lens analysis |
| `verify-story-thread.ts` | `npm run verify:story-thread` | Tests story thread pipeline |
| `verify-onboarding.ts` | `npm run verify:onboarding` | Tests onboarding endpoints |
| `verify-achievements.ts` | `tsx scripts/verify-achievements.ts` | Tests achievement calculation |
| `verify-review-ui.ts` | `tsx scripts/verify-review-ui.ts` | Tests review card rendering |
| `verify-summary-mode.ts` | `tsx scripts/verify-summary-mode.ts` | Tests deep reading vs casual |
| `verify-ai-reader.ts` | `npm run verify:ai-reader` | Tests AI Reader chunk analysis + synthesis parsing |
| `verify-reading-rhythm.ts` | `npm run verify:reading-rhythm` | Tests reading rhythm streak + milestone calculation |
| `verify-read-today.ts` | `npm run verify:read-today` | Tests Read Today button DOM constraints |

### AI Reader batch job

```bash
npx tsx scripts/run-ai-reader.ts                 # all books
npx tsx scripts/run-ai-reader.ts --book-id <id>  # single book
npx tsx scripts/run-ai-reader.ts --force          # reprocess all chunks
```

No npm script is registered for this — invoke directly with `npx tsx`.

### User management scripts

```bash
npm run create-user     # Create a new user (interactive)
npm run delete-user     # Delete a user (interactive)
npm run reset-password  # Reset a user's password (interactive)
```

## Database setup

### Schema initialisation
The `chapter` schema must exist in the `dwh` database. An admin must run this once:

```bash
psql "$DATABASE_URL" -c "CREATE SCHEMA IF NOT EXISTS chapter;"
```

After that, the app's `ensureSchema()` function runs all `CREATE TABLE IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS` statements on every boot. No manual SQL is needed for normal operation.

### Migrations
Additional SQL migrations in `/migrations/` are **not** auto-applied. They must be run manually:

```bash
psql "$DATABASE_URL" -f migrations/<filename>.sql
```

Current migrations:
- `20260723_multi_user.sql` — Adds `owner_id` to books
- `20260724_add_onboarding_progress.sql` — Onboarding progress table
- `20260724_add_reading_lens_analyses.sql` — Reading lens table
- `20260724_add_story_thread.sql` — Story thread table
- `20260724_add_summary_mode.sql` — Summary mode column
- `20260724_remove_community.sql` — Drops community feature
- `20260724_telegram_linking.sql` — Telegram link columns
- `20260726_add_ai_reader.sql` — `ai_reader_chunks` + `book_wiki` tables
- `20260726_expand_ai_reader_narrative.sql` — Narrative arc, output language, AI reader job tracking
- `20260726_ai_reader_continuity_map_v2.sql` — V2 continuity maps and resolved language enforcement

## CI / OpenWiki workflow

A scheduled GitHub Actions workflow (`.github/workflows/openwiki-update.yml`) runs daily at 00:00 UTC (07:00 Bangkok time):

1. Checks out the `dev` branch on the self-hosted runner
2. Installs OpenWiki CLI + Mermaid + jsdom
3. Runs `openwiki code --update --print` with the project's LLM configuration
4. Commits any wiki changes back to the `dev` branch

The workflow is triggered on schedule and via `workflow_dispatch` for manual runs.

## Health check

`GET /health` returns `{ ok: true }`. This endpoint intentionally bypasses session/auth and database — it is purely for load balancer / PM2 liveness probes.

## Book files

Books are stored as PDF or EPUB files on disk. The `CHAPTER_BOOKS_DIR` environment variable sets the base directory. When adding a book:
- **Absolute paths** (starting with `/`) are kept as-is (backward compatible)
- **Relative paths** are resolved inside `CHAPTER_BOOKS_DIR`

File upload via the `AddBookModal` uses multer middleware (configured in [`/src/upload.ts`](../src/upload.ts)):
- Max size: 100 MB
- Allowed types: `.pdf`, `.epub`
- Filename sanitized (lowercased, non-alphanumeric → dashes, UUID suffix)

## Production considerations

1. **TLS termination** — The Express `trust proxy` setting assumes a reverse proxy (nginx/Caddy) handles TLS. Secure cookies are enabled when `NODE_ENV=production`.
2. **Session store** — Uses PostgreSQL via `connect-pg-simple`. A `DATABASE_URL` must be set for sessions to persist across restarts.
3. **Timezone** — All date logic uses `Asia/Bangkok` (UTC+7). This is hardcoded in multiple modules. If deploying in a different timezone, change the `APP_TZ` constant in `src/routes/books.ts` and related files.
4. **Single instance** — PM2 runs one instance. The app stores no in-memory state that would require sticky sessions (all state is in PostgreSQL).
5. **n8n cron** — The daily workflow calls the server's `POST /api/books/all/advance` endpoint. Ensure the n8n instance can reach the Chapter server over the network.
