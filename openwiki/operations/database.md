---
type: runbook
title: Database Operations & Runbook
description: Comprehensive guide for database migration procedures, environment setup, Telegram integration, scheduled jobs, backup/restore, and PM2 production deployment.
tags: [database, postgresql, operations, migrations, telegram, pm2, backup]
verified:
  - by: openwiki/0.4.3
    at: 2026-08-29T19:44:06.027Z
sources:
  - id: openwiki-source-5f5b95b3d6a215fa02ceb945
    resource: repo://.env.example
  - id: openwiki-source-70d4664310eebb80ab5b564c
    resource: repo://src/db.ts
  - id: openwiki-source-cee005696eb3fd632ce1fbad
    resource: repo://update.sh
generated: { by: "openwiki/0.4.3", at: "2026-08-29T19:44:06.027Z" }
---

# Database Operations & Runbook

This runbook covers operational procedures for database setup, migrations, backups, maintenance, PM2 production deployment, and scheduled integrations (such as Telegram webhooks, bots, and automated jobs) for the Chapter application.

## 1. Environment Configuration (`.env.example`)

The application relies on environment variables defined in `.env.example`. In production or development, copy this file to `.env.local` and populate the appropriate values:

```bash
cp .env.example .env.local
```

### Key Configuration Variables

- **Database Connection**:
  - `DATABASE_URL`: PostgreSQL connection string (e.g., `postgresql://dwh:password@localhost:5432/dwh`). If passwords contain special characters (`@`, `#`, `/`, `:`, `$`, `%`, `+`), URL-encode them.
- **Database Execution Bounds**:
  - `DB_REQUEST_STATEMENT_TIMEOUT_MS`: Tight timeout for API request transactions (default `12000`).
  - `DB_REQUEST_LOCK_TIMEOUT_MS`: Lock timeout for API requests (default `2000`).
  - `DB_BACKGROUND_STATEMENT_TIMEOUT_MS`: Larger bounded budget for background/batch work (default `120000`).
  - `DB_BACKGROUND_LOCK_TIMEOUT_MS`: Lock timeout for background work (default `5000`).
- **Telegram & Bot Integration**:
  - `TELEGRAM_BOT_TOKEN`: Bot token provided by `@BotFather`.
  - `TELEGRAM_CHAT_ID`: Numeric chat ID for administrative alerts or delivery.
  - `PODCAST_TELEGRAM_ARCHIVE_CHAT_ID`: Private archive chat ID for podcast audio and metadata storage.
- **Release Environment**:
  - `APP_ENV`: Deployment environment (`prd` or `dev`).
  - `CHAPTER_BRANCH`: Git branch associated with the release (`master` or `dev`).
  - `CHAPTER_PM2_NAME`: PM2 process name (`chapter-prd` or `chapter-dev`).
  - `PORT`: HTTP listener port (e.g., `3000` or `3001`).

---

## 2. Database Schema & Migrations

### Schema Initialization
The application automatically ensures schema correctness upon server startup via `ensureSchema()`, which reads and executes statements from `src/db/schema.sql` [repo://src/db.ts#L154-L185]. Additionally, `verifyCoreSchema()` checks that all required tables (such as `books`, `reading_log`, `podcasts`, `subscriptions`, `billing_orders`, etc.) are present in the `chapter` schema [repo://src/db.ts#L187-L207].

### Migration Procedures
1. **Adding Migration Files**: Place new SQL migration scripts in the `migrations/` directory using timestamped naming conventions (e.g., `YYYYMMDD_description.sql`).
2. **Applying Migrations**: Migrations can be applied directly via PostgreSQL client or integrated into deployment routines.
3. **Verification**: The update script (`update.sh`) verifies core relations against PostgreSQL using `psql` during deployment [repo://update.sh#L87-L97].

---

## 3. Telegram Webhook & Bot Integration Setup

The application interacts with Telegram for notifications, content delivery, and podcast archiving.

- **Bot Token & Chat ID**: Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `.env.local`.
- **Webhook / Polling Configuration**: Ensure the bot can reach the public origin defined in `APP_URL`.
- **Podcast Archiving**: `PODCAST_TELEGRAM_ARCHIVE_CHAT_ID` must point to a private Telegram chat where the bot has permission to post messages and audio files.

---

## 4. Scheduled Jobs & Background Tasks

Background operations, such as periodic synchronization, podcast recaps, and reminder dispatches, operate under controlled transaction scopes:
- **Background Transactions**: Managed via `withBackgroundTransaction`, providing relaxed execution bounds (`DB_BACKGROUND_STATEMENT_TIMEOUT_MS`) compared to interactive API requests [repo://src/db.ts#L147-L152].
- **Cron / Automation**: Typically orchestrated via external schedulers (e.g., n8n workflows or system cron) hitting internal API endpoints secured with administrative tokens (`ADMIN_TOKEN`).

---

## 5. Backup and Restore Procedures

### Automated / Manual Backups
Backups of the PostgreSQL database (`dwh`) and the `chapter` schema can be performed using standard `pg_dump` utilities:

```bash
# Backup the chapter schema
pg_dump -U dwh -d dwh --schema=chapter -F c -b -v -f "chapter_backup_$(date +%Y%m%d_%H%M%S).dump"

# Full database backup
pg_dump -U dwh -d dwh -F c -b -v -f "dwh_full_backup_$(date +%Y%m%d_%H%M%S).dump"
```

### Restore Procedures
To restore from a custom-format dump:

```bash
# Restore specific schema
pg_restore -U dwh -d dwh --schema=chapter -v "chapter_backup_YYYYMMDD_HHMMSS.dump"
```

---

## 6. PM2 Production Deployment & Runbook

Production deployments are managed using PM2 and the repository-root `update.sh` script, paired with `ecosystem.config.cjs`.

### Deployment Steps (`update.sh`)
When pushing updates to the production server (e.g., `/opt/chapter`), execute `update.sh`:

```bash
./update.sh
```

The script performs the following validation and deployment checks:
1. Validates the existence of `.env.local` [repo://update.sh#L11-L14].
2. Checks environment variables (`CHAPTER_PM2_NAME`, `CHAPTER_BRANCH`, `PORT`, `APP_ENV`) [repo://update.sh#L17-L32].
3. Fetches the latest code from git (`git pull`) [repo://update.sh#L48-L51].
4. Installs dependencies and builds the application (`npm install && npm run build`) [repo://update.sh#L53-L57].
5. Reloads or starts the PM2 process defined by `ecosystem.config.cjs` [repo://update.sh#L66-L74].
6. Verifies database schema integrity and pings the health endpoint (`GET /health`) [repo://update.sh#L87-L122].

### PM2 Management Commands
- **View Status**: `pm2 status`
- **View Logs**: `pm2 logs chapter-prd`
- **Restart Application**: `pm2 restart chapter-prd`
