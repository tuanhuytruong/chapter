---
type: concept
title: Domain Model
description: Core domain models and business logic concepts including reading companions, reading intentions, book uploads, and podcast status management.
tags: [domain, models, business-logic, books, podcasts, companions]
sources:
  - id: openwiki-source-a7bfcf9c7093732581286157
    resource: repo://migrations/20260826_add_book_reading_intention.sql
  - id: openwiki-source-1c4642b1e8b0904d58359f74
    resource: repo://migrations/20260826_add_podcast_unavailable_status.sql
  - id: openwiki-source-ddf75957c1dba6e13c946ffe
    resource: repo://src/components/ReadingProgressCard.tsx
  - id: openwiki-source-125e76395473d098c7269d6d
    resource: repo://src/db/schema.sql
  - id: openwiki-source-c457d3d1a63d5dc86f0da7ef
    resource: repo://src/types.ts
generated: {by: "openwiki/0.4.0", at: "2026-08-26T19:17:20.603Z"}
verified:
  - by: openwiki/0.5.0
    at: 2026-09-05T16:00:46.565Z
---

# Domain Model

The OpenWiki core domain encompasses user-owned books, reading sessions, AI-driven reading progress companions, reading intentions, and podcast generation management. This model bridges raw book files and extracted text with interactive reading progression, continuous thread tracking, and podcast summaries.

## Core Entities and Relationships

```mermaid
erDiagram
    BookRow ||--o{ ReadingRoundRow : has
    BookRow ||--o{ ReadingProgressCompanionRow : generates
    BookRow ||--o{ ReadingLensRow : analyzes
    BookRow ||--o{ PodcastRow : produces
    BookRow {
        string id PK
        string title
        string author
        string file_path
        string status
        int current_page
        int current_reading_round
        string reading_intention
    }
    ReadingProgressCompanionRow {
        string book_id PK
        int reading_round PK
        json main_thread
        json converging
        json open_threads
        json carry_forward
        boolean stale
    }
    PodcastRow {
        string id PK
        string book_id FK
        string status
    }
```

## Reading Companions and Threads

The **Reading Progress Companion** (`ReadingProgressCompanionRow`) synthesizes a book's ongoing reading logs into structured narrative threads for the current reading round. 

- **Main Thread**: The central continuous argument or narrative spine tracked across sessions.
- **Converging**: Themes or arguments where multiple reading insights intersect.
- **Open Threads**: Unresolved questions or narrative tension points to carry into subsequent pages.
- **Carry Forward**: Durable insights and principles preserved across reading rounds.

Companions maintain a `stale` flag (`ReadingProgressCompanionRow#stale`) which becomes true when new reading sessions are logged after the last companion generation, prompting readers to refresh their reading thread.

## Reading Intentions

Books support an owner-private **reading intention** (`BookRow#reading_intention`, introduced in migration `20260826_add_book_reading_intention.sql`). This field records the reader's personal motivation, learning goals, or inquiry focus when starting a book. It remains private to the owner and is distinct from shared book notes or public reviews.

## Book Upload and Content Processing

Books are ingested as PDF or EPUB files (`BookRow#file_type`). Content processing pipelines extract raw text from uploaded files, breaking text down into parseable chunks, chapters, and page ranges so that AI components (such as Reading Lenses and Companions) can generate grounded citations (`ReadingProgressItem#refs`).

## Podcast Status Management

Podcasts generated from books or daily reflections track asynchronous generation and archiving lifecycles through explicit status constraints. The status lifecycle includes:

- `queued`: Awaiting worker pick-up.
- `scripting`: Generating the dialogue or script.
- `synthesizing`: Converting scripts to audio via TTS.
- `archiving` / `archive_pending`: Storing audio artifacts.
- `ready`: Available for playback and download.
- `failed`: Encountered a terminal error during generation.
- `unavailable`: Marked as explicitly unavailable (introduced in migration `20260826_add_podcast_unavailable_status.sql`) when source material or generation prerequisites become invalid or deleted.
