---
type: Concept
title: Chapter — Data Model
description: PostgreSQL schema for the Chapter app — books, reading_log, users, sessions, book_reading_units, review_cards, and analysis tables.
tags: [database, postgresql, schema, data-model]
---

# Data Model

All tables live in the `chapter` schema of the `dwh` database. The schema is applied idempotently at server boot by [`ensureSchema()`](../src/db.ts#L81) reading [`src/db/schema.sql`](../src/db/schema.sql). Migrations in `/migrations/` add further columns and tables.

## Entity relationship diagram

```mermaid
erDiagram
    users {
        uuid id PK
        varchar username "unique"
        varchar display_name
        varchar password_hash
        varchar avatar_url "nullable"
        varchar telegram_chat_id "nullable, per-user"
        varchar telegram_link_token "nullable, ephemeral"
        timestamptz telegram_link_expires_at
        timestamptz created_at
    }

    session {
        varchar sid PK
        json sess
        timestamp expire
    }

    books {
        uuid id PK
        varchar title
        varchar author
        text file_path
        text file_type "pdf | epub"
        int total_pages
        int daily_pages "default 3"
        int current_page
        text status "active | paused | finished | queued"
        text summary_lang "auto | vi | en"
        text summary_mode "casual | deep_reading"
        text reading_experience "analytical | story"
        text cover_url "nullable"
        uuid owner_id FK
        int queue_order "nullable"
        text reflection_text "nullable"
        timestamptz reflection_at "nullable"
        timestamptz created_at
    }

    reading_log {
        uuid id PK
        uuid book_id FK
        date date "reading date"
        int session "session number per book"
        int page_start
        int page_end
        text raw_text
        text summary
        text key_insights "JSON array"
        text quote
        text notes "nullable"
        boolean telegram_sent
        timestamptz created_at
    }

    book_reading_units {
        uuid id PK
        uuid book_id FK
        int unit_index
        varchar title "nullable"
        text raw_text
        int char_count
        timestamptz created_at
    }

    review_cards {
        uuid id PK
        uuid book_id FK
        uuid owner_id FK
        text insight
        int interval "1 | 3 | 7 | 14 | 30"
        int repetitions
        date due_date
        timestamptz created_at
    }

    reading_lens_analyses {
        uuid id PK
        uuid book_id FK
        uuid log_id FK
        jsonb analysis "structured JSON"
        text analyst_summary
        int schema_version
        timestamptz created_at
        timestamptz updated_at
    }

    story_thread_analyses {
        uuid id PK
        uuid book_id FK
        uuid log_id FK
        jsonb analysis "structured JSON"
        jsonb cumulative_state "merged state snapshot"
        int schema_version
        timestamptz created_at
        timestamptz updated_at
    }

    weekly_goals {
        uuid id PK
        uuid owner_id FK
        text metric "sessions | units"
        int target
        date week_start
        timestamptz created_at
        timestamptz updated_at
    }

    onboarding_progress {
        uuid owner_id PK FK
        text[] dismissed_steps
        timestamptz updated_at
    }

    users ||--o{ books : owns
    books ||--o{ reading_log : has
    books ||--o{ book_reading_units : "has (EPUB only)"
    books ||--o{ review_cards : "generates insights"
    books ||--o{ reading_lens_analyses : "analyzed"
    books ||--o{ story_thread_analyses : "analyzed"
    reading_log ||--o{ reading_lens_analyses : "produced"
    reading_log ||--o{ story_thread_analyses : "produced"
    users ||--o{ review_cards : reviews
    users ||--o{ weekly_goals : sets
    users ||--o{ onboarding_progress : tracks
    users ||--o| session : "has 0..1"
```

## Core tables

### `chapter.users`
Stores reader accounts. Passwords hashed with bcrypt. Telegram linking uses a three-column state machine (`telegram_chat_id`, `telegram_link_token`, `telegram_link_expires_at`) — the token is set when the user requests a link, then consumed by the Telegram webhook when the user taps `/start`.

### `chapter.session`
Express session store (connect-pg-simple). Expired sessions are cleaned up by PostgreSQL automatically if the extension `pg_cron` is configured, or by the app.

### `chapter.books`
The primary library entity. Key columns:

- **`file_type`** — `'pdf'` or `'epub'`. Determines which extraction strategy to use.
- **`total_pages`** — For PDF: number of pages in the file. For EPUB: number of reading chunks built from the text.
- **`daily_pages`** — How many pages/chunks to advance per reading session (default 3).
- **`current_page`** — Current position cursor.
- **`status`** — lifecycle: `queued` → `active` → `paused` | `finished`.
- **`reading_experience`** — `'analytical'` (non-fiction, generates Reading Lens) or `'story'` (fiction, generates Story Thread).
- **`summary_mode`** — `'casual'` (3-5 sentence narrative) or `'deep_reading'` (structured section-by-section analysis).
- **`queue_order`** — Optional ordinal for the reading queue.

### `chapter.reading_log`
One row per reading session. Stores the raw extracted text, the AI-generated summary, key insights (JSON array), and a memorable quote. Sessions are numbered per-book (`session` column increments).

### `chapter.book_reading_units`
Persists stable, paragraph-aware reading chunks for EPUB books (since EPUB text reflows and has no fixed page count). Built once on first access via `ensureEpubReadingUnits()` in the books router.

## Analysis tables

### `chapter.reading_lens_analyses`
Used when `reading_experience = 'analytical'`. Stores structured JSON with `coreArgument`, `argumentMap`, `keyConcepts`, `assumptionsAndLimits`, `questionsToCarryForward`, `durableInsights`, `quote`. See [Reading Engine](reading-engine.md) for schema details and prompt structure.

### `chapter.story_thread_analyses`
Used when `reading_experience = 'story'`. Stores structured JSON analysis plus a `cumulative_state` JSONB column that aggregates thread and character state across all sessions. State is rebuilt from scratch on every upsert to avoid stale data from retries.

## Supporting tables

| Table | Purpose |
|-------|---------|
| `chapter.review_cards` | Spaced-repetition review cards derived from reading insights. Intervals: 1, 3, 7, 14, 30 days. |
| `chapter.weekly_goals` | Per-user weekly goal targeting `sessions` or `units` read. Week starts Monday in Asia/Bangkok. |
| `chapter.onboarding_progress` | Per-user dismissed onboarding step IDs. Content is client-side. |

## Migrations

Migrations in `/migrations/` are SQL files named with date prefixes:

| File | Added |
|------|-------|
| `20260723_multi_user.sql` | Multi-user support, `owner_id` on books |
| `20260724_add_onboarding_progress.sql` | Onboarding progress table |
| `20260724_add_reading_lens_analyses.sql` | Reading lens analyses table |
| `20260724_add_story_thread.sql` | Story thread analyses table |
| `20260724_add_summary_mode.sql` | summary_mode column |
| `20260724_remove_community.sql` | Community feature removal |
| `20260724_telegram_linking.sql` | Telegram link columns on users |

## Key design decisions

1. **Schema-per-boot, not migration-framework** — `ensureSchema()` reads `schema.sql` and runs each statement independently. If a statement fails (e.g. `CREATE SCHEMA` denied), the rest continue. Migrations add columns idempotently via `ADD COLUMN IF NOT EXISTS`.
2. **DATE type returns strings** — The pg type parser for DATE OID (1082) is set to return raw strings (`YYYY-MM-DD`) instead of JavaScript Date objects, preventing timezone shift issues in the frontend.
3. **EPUB progress is chunk-indexed** — Since EPUB has no fixed pages, the app builds stable text chunks (`book_reading_units`) once per book and uses chunk index as the progress cursor. This prevents progress from shifting if the EPUB is re-parsed.
4. **Cumulative state is rebuilt** — Story thread analyses store a `cumulative_state` that is recalculated from all prior analyses on each upsert, ensuring retries don't leave stale merged data.
