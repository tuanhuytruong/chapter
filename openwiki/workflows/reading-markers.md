---
type: workflow
title: Reading Markers Workflow
description: End-to-end user and system workflow for reading markers, day summaries, and book detail integration.
tags: [reading-markers, workflow, database, api, frontend]
verified:
  - by: openwiki/0.4.3
    at: 2026-08-29T00:58:11.655Z
sources:
  - id: openwiki-source-fa0ff70930b09c59a414a681
    resource: repo://migrations/20260828_add_reading_markers.sql
  - id: openwiki-source-d9d8bf4d1ec3b639a557849b
    resource: repo://src/components/DaySummary.tsx
  - id: openwiki-source-d2891e039c28a3d099c7f34f
    resource: repo://src/components/ReadingMarkers.tsx
  - id: openwiki-source-449cc5af19f441ac60ec275b
    resource: repo://src/routes/books.ts
generated: { by: "openwiki/0.4.3", at: "2026-08-29T00:58:11.655Z" }
---

# Reading Markers Workflow

## Overview

The Reading Markers feature allows book owners to bookmark specific moments during their reading sessions. Each marker captures a particular position (page or EPUB chunk) within a saved reading session, categorized by kind (`idea`, `question`, `quote`, or `return_to`), accompanied by an optional private note (up to 500 characters). Markers are scoped to a specific reading round and owner.

## End-to-End Control Flow

```mermaid
sequenceDiagram
    autonumber
    participant User
    participant BookDetail as BookDetail Component
    participant DaySummary as DaySummary Component
    participant API as Books API Router
    participant DB as PostgreSQL Database

    User->>BookDetail: Opens active book detail
    BookDetail->>API: GET /api/books/:id/markers?round=N
    API->>DB: Query reading_markers joined with reading_log
    DB-->>API: Returns marker rows
    API-->>BookDetail: Returns marker array
    BookDetail->>ReadingMarkers: Renders private markers list

    User->>DaySummary: Clicks "Mark" on a session
    DaySummary->>DaySummary: Fills marker kind & optional note
    User->>DaySummary: Submits marker form
    DaySummary->>API: POST /api/books/:id/markers { log_id, page_position, kind, note }
    API->>DB: Validates book is active & session matches round
    API->>DB: INSERT / ON CONFLICT DO UPDATE reading_markers
    DB-->>API: Returns created/updated marker row
    API-->>DaySummary: Returns 201 Created with marker details
    DaySummary->>BookDetail: Triggers onMarkerCreated callback
    BookDetail->>API: Re-fetches markers and state
    BookDetail->>ReadingMarkers: Re-renders updated marker list

    User->>ReadingMarkers: Clicks delete button or "Go" session link
    alt Deleting Marker
        ReadingMarkers->>API: DELETE /api/books/:id/markers/:markerId
        API->>DB: DELETE FROM reading_markers
        DB-->>API: Deleted count
        API-->>BookDetail: Returns { ok: true }
    else Navigating to Session
        ReadingMarkers->>DaySummary: Calls onGoToSession(logId)
        DaySummary->>DaySummary: Scrolls session card into view & highlights
    end
```
*Sequence diagram showing user interaction with reading markers via BookDetail and DaySummary components, and backend persistence.*

## Database Schema

Markers are stored in the `chapter.reading_markers` table, introduced in migration repo://migrations/20260828_add_reading_markers.sql:

```sql
CREATE TABLE IF NOT EXISTS chapter.reading_markers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES chapter.books(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES chapter.users(id) ON DELETE CASCADE,
  reading_round INT NOT NULL CHECK (reading_round >= 1),
  log_id UUID NOT NULL REFERENCES chapter.reading_log(id) ON DELETE CASCADE,
  page_position INT NOT NULL CHECK (page_position >= 0),
  kind TEXT NOT NULL CHECK (kind IN ('idea', 'question', 'quote', 'return_to')),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (book_id, owner_id, log_id, page_position, kind, note)
);
```

An index is maintained for efficient retrieval ordered by creation time:
```sql
CREATE INDEX IF NOT EXISTS idx_reading_markers_book_owner_round_created
  ON chapter.reading_markers (book_id, owner_id, reading_round, created_at DESC);
```

## Backend API Endpoints

Defined in repo://src/routes/books.ts:

1. **GET `/api/books/:id/markers?round=N`**:
   - Requires ownership via repo://src/routes/books.ts#L871.
   - Retrieves all markers for the book, owner, and specified reading round (`reading_round`), joined with session details (`reading_log`) and formatted with a position label (`Page X` or `Chunk X`).

2. **POST `/api/books/:id/markers`**:
   - Creates or updates a marker repo://src/routes/books.ts#L890-L923.
   - Validates that the book is active repo://src/routes/books.ts#L902-L903, the session belongs to the current reading round repo://src/routes/books.ts#L908-L909, and the `page_position` falls within the session's page/chunk range repo://src/routes/books.ts#L910-L911.

3. **DELETE `/api/books/:id/markers/:markerId`**:
   - Deletes a specific marker owned by the user repo://src/routes/books.ts#L925-L938.

## Frontend Components

- **`ReadingMarkers`** (repo://src/components/ReadingMarkers.tsx):
  - Renders the list of private markers on the book detail page.
  - Supports deleting markers and jumping directly to associated session logs.
- **`DaySummary`** (repo://src/components/DaySummary.tsx):
  - Embeds the inline marker creation form within any saved reading session.
- **`BookDetail`** (repo://src/pages/BookDetail.tsx):
  - Coordinates state loading for markers, rounds, logs, and triggers re-fetches upon marker creation or deletion.
