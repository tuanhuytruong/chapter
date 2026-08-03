---
type: Concept
title: Chapter — Data Model
description: PostgreSQL schema for the Chapter app — books, reading_log, users, sessions, book_reading_units, review_cards, analysis tables, AI Reader storage (ai_reader_chunks, book_wiki), and job tracking.
tags: [database, postgresql, schema, data-model, ai-reader]
---

# Data Model

All tables live in the `chapter` schema of the `dwh` database. The schema is applied idempotently at server boot by [`ensureSchema()`](../src/db.ts#L81) reading [`src/db/schema.sql`](../src/db/schema.sql). Migrations in `/migrations/` add further columns and tables.

## Entity relationship diagram

<!-- openwiki: mermaid parse failed and this diagram was converted to a text fence so it does not break rendering. Fix the diagram source and restore the mermaid fence. Parser error: Parse error on line 101: ... uuid book_id PK FK int readi Expecting 'BLOCK_STOP', 'ATTRIBUTE_WORD', ',', 'COMMENT', got 'ATTRIBUTE_KEY' -->
```text
erDiagram
    users {
        uuid id PK
        varchar username "unique"
        varchar display_name
        varchar password_hash
        varchar avatar_url
        varchar telegram_chat_id
        varchar telegram_link_token
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
        text file_type "pdf or epub"
        int total_pages
        int daily_pages
        int current_page
        text status "active, paused, finished, queued"
        text summary_lang "auto, vi, en"
        text summary_mode "casual, deep_reading"
        text reading_experience "analytical, story"
        text cover_url
        uuid owner_id FK
        int queue_order
        text reflection_text
        timestamptz reflection_at
        timestamptz created_at
    }

    reading_log {
        uuid id PK
        uuid book_id FK
        date date
        int session
        int page_start
        int page_end
        text raw_text
        text summary
        text key_insights[]
        text quote
        text notes
        boolean telegram_sent
        timestamptz created_at
    }

    book_reading_units {
        uuid id PK
        uuid book_id FK
        int unit_index
        varchar title
        text raw_text
        int char_count
        timestamptz created_at
    }

    review_cards {
        uuid id PK
        uuid book_id FK
        uuid owner_id FK
        text insight
        int interval
        int repetitions
        date due_date
        timestamptz created_at
    }

    reading_lens_analyses {
        uuid id PK
        uuid book_id FK
        uuid log_id FK
        jsonb analysis
        text analyst_summary
        int schema_version
        timestamptz created_at
        timestamptz updated_at
    }

    story_thread_analyses {
        uuid id PK
        uuid book_id FK
        uuid log_id FK
        jsonb analysis
        jsonb cumulative_state
        int schema_version
        timestamptz created_at
        timestamptz updated_at
    }

    story_state_snapshots {
        uuid book_id PK FK
        int reading_round
        uuid last_log_id FK
        jsonb state
        timestamptz updated_at
    }

    ai_reader_chunks {
        uuid id PK
        uuid book_id FK
        uuid log_id FK
        int page_start
        int page_end
        jsonb chunk_analysis
        timestamptz processed_at
    }

    book_wiki {
        uuid book_id PK FK
        int pages_covered
        text overview
        jsonb concepts
        jsonb themes
        jsonb people
        jsonb chapter_map
        jsonb notable_quotes
        jsonb open_questions
        smallint schema_version
        text output_language
        text book_so_far
        jsonb current_position
        jsonb narrative_arc
        jsonb carry_forward_insights
        jsonb reading_path
        jsonb thread_map
        jsonb entity_map
        jsonb connections
        jsonb current_reading_state
        text next_session_context
        timestamptz generated_at
        int generation_ms
    }

    ai_reader_jobs {
        uuid book_id PK FK
        text status "idle, running, failed"
        timestamptz started_at
        timestamptz completed_at
        text error_message
    }

    weekly_goals {
        uuid id PK
        uuid owner_id FK
        text metric "sessions, units"
        int target
        date week_start
        timestamptz created_at
        timestamptz updated_at
    }

    onboarding_progress {
        uuid owner_id PK FK
        text dismissed_steps[]
        timestamptz updated_at
    }

    users ||--o{ books : owns
    books ||--o{ reading_log : has
    books ||--o{ book_reading_units : "has (EPUB only)"
    books ||--o{ review_cards : generates
    books ||--o{ reading_lens_analyses : analyzed_by
    books ||--o{ story_thread_analyses : analyzed_by
    books ||--o{ story_state_snapshots : has_state
    books ||--o{ ai_reader_chunks : processed_by
    books ||--o| book_wiki : wiki
    books ||--o| ai_reader_jobs : job_tracking
    reading_log ||--o{ reading_lens_analyses : produced
    reading_log ||--o{ story_thread_analyses : produced
    reading_log ||--o{ ai_reader_chunks : chunked
    reading_log ||--o{ story_state_snapshots : last_log
    users ||--o{ review_cards : reviews
    users ||--o{ weekly_goals : sets
    users ||--o{ onboarding_progress : tracks
    users ||--o| subscriptions : has
    users ||--o{ usage_events : incurs
    users ||--o| session : "has 0 or 1"
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

### `chapter.story_state_snapshots`
Caches the merged story-thread state for quick lookups during book detail rendering. Updated on every story thread analysis upsert.

## AI Reader storage

### `chapter.ai_reader_chunks`
One row per processed reading-log session. The `chunk_analysis` JSONB stores the per-session LLM output (concepts, themes, people, notable_quotes, close reading, threads, entities, evidence, handoff). Unique on `log_id`.

### `chapter.book_wiki`
The synthesised per-book wiki, upserted on each AI Reader run. Schema versioning (currently V2) enables additive column migrations. Key JSONB columns:

| Column | V1 | V2 | Contents |
|--------|----|----|----------|
| `concepts`, `themes`, `people` | Yes | Yes | Per-book extracted concepts, themes, and character overviews |
| `chapter_map` | Yes | Yes | Ordered list of pages with summaries |
| `notable_quotes` | Yes | Yes | Memorable quotes with page anchors |
| `open_questions` | Yes | Yes | Unresolved questions from the reading |
| `book_so_far`, `current_position` | V1.5 | Yes | Narrative position and ongoing story summary |
| `narrative_arc`, `carry_forward_insights` | — | Yes | Arc tracking and cross-session insights |
| `reading_path`, `thread_map`, `entity_map`, `connections` | — | Yes (V2) | Continuity maps for threads, entities, and their relationships |
| `current_reading_state`, `next_session_context` | — | Yes (V2) | Session-level state summary and handoff |

### `chapter.ai_reader_jobs`
Background job tracking with status `idle | running | failed` to prevent concurrent `run-ai-reader` executions on the same book.

## Supporting tables

| Table | Purpose |
|-------|---------|
| `chapter.review_cards` | Spaced-repetition review cards derived from reading insights. Intervals: 1, 3, 7, 14, 30 days. |
| `chapter.weekly_goals` | Per-user weekly goal targeting `sessions` or `units` read. Week starts Monday in Asia/Bangkok. |
| `chapter.subscriptions` | One provider-neutral membership entitlement per user (`free`, `plus`, or `deep_reader`) with status, period, grant source, and optional provider identifiers. |
| `chapter.usage_events` | Idempotent audit ledger for feature usage reservations, consumption, releases, and adjustments by Bangkok billing period; Phase 0 does not yet enforce quotas. |
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
| `20260726_add_ai_reader.sql` | `ai_reader_chunks` + `book_wiki` tables |
| `20260726_expand_ai_reader_narrative.sql` | V1 narrative columns (schema_version, output_language, book_so_far, current_position, narrative_arc, carry_forward_insights) + `ai_reader_jobs` table |
| `20260726_ai_reader_continuity_map_v2.sql` | V2 continuity columns (reading_path, thread_map, entity_map, connections, current_reading_state, next_session_context) + resolved language enforcement |

## Key design decisions

1. **Schema-per-boot, not migration-framework** — `ensureSchema()` reads `schema.sql` and runs each statement independently. If a statement fails (e.g. `CREATE SCHEMA` denied), the rest continue. Migrations add columns idempotently via `ADD COLUMN IF NOT EXISTS`.
2. **DATE type returns strings** — The pg type parser for DATE OID (1082) is set to return raw strings (`YYYY-MM-DD`) instead of JavaScript Date objects, preventing timezone shift issues in the frontend.
3. **EPUB progress is chunk-indexed** — Since EPUB has no fixed pages, the app builds stable text chunks (`book_reading_units`) once per book and uses chunk index as the progress cursor. This prevents progress from shifting if the EPUB is re-parsed.
4. **Cumulative state is rebuilt** — Story thread analyses store a `cumulative_state` that is recalculated from all prior analyses on each upsert, ensuring retries don't leave stale merged data.
