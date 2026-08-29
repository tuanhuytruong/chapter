---
type: concept
title: AI Reader & Narratives
description: Domain concepts for AI Reader, reading rounds, narrative continuity, and cross-book connections.
tags: [ai-reader, reading-rounds, narrative-continuity, cross-book-connections, wiki]
verified:
  - by: openwiki/0.4.3
    at: 2026-08-29T19:44:06.027Z
sources:
  - id: openwiki-source-6b1db57a0627fa8cd59cc63a
    resource: repo://migrations/20260829_backfill_reading_round_history.sql
  - id: openwiki-source-2595616fbfe0d9510c40d225
    resource: repo://src/aiReader.ts
  - id: openwiki-source-4100b477ad8e9b7473ae375c
    resource: repo://src/crossBookConnections.ts
generated: { by: "openwiki/0.4.3", at: "2026-08-29T19:44:06.027Z" }
---

# AI Reader & Narratives

The AI Reader is an analytical intelligence layer in OpenWiki that processes saved reading sessions, builds persistent narrative continuity, synthesizes book wikis, and connects insights across multiple books. Rather than operating on raw uploaded files directly, the AI Reader consumes structured text extracted from persisted session text and reading logs.

```mermaid
sequenceDiagram
    participant User
    participant Chapter as Reading Session
    participant AIReader as AI Reader Engine
    participant DB as Database / Wiki
    
    User->>Chapter: Complete reading session & save notes/text
    Chapter->>AIReader: Queue session text for chunk analysis
    AIReader->>AIReader: Run LLM chunk analysis (JSON mode)
    AIReader->>DB: Store chunk analysis & thread/entity updates
    AIReader->>AIReader: Synthesise all chunks into book wiki
    AIReader->>DB: Persist updated BookWiki, narrative arc & maps
```
*Figure 1: End-to-end AI Reader chunk analysis and wiki synthesis workflow.*

## Core Architecture & Data Flow

### 1. Persisted Session Text as Input
Rather than parsing raw uploaded files (such as PDFs) during runtime inference, the AI Reader consumes persisted session text and reading logs stored in the database (`reading_log`, `book_wiki`, etc.). This ensures stability, avoids redundant parsing overhead, and guarantees that the AI analyzes exactly what the reader recorded or highlighted during their reading sessions.

### 2. Reading Rounds & Lifecycle
Books undergo distinct reading rounds (`reading_round` tracking via `book_reading_rounds` and `reading_log`). As readers progress through multiple readings or revisit books, historical rounds are preserved and backfilled (e.g., via migration scripts like `20260829_backfill_reading_round_history.sql`). This historical tracking allows the AI Reader to distinguish between initial impressions and subsequent deeper engagements.

### 3. Continuity Map & Narrative Generation
The AI Reader maintains a rich narrative continuity structure that evolves session by session:
- **Chunk Analysis (`analyseChunk` / `analyseChunkBatch`)**: Processes individual reading sessions independently into structured insights, including close readings, what changes, active threads, entities, and evidence excerpts.
- **Wiki Synthesis (`synthesiseWiki`)**: Aggregates chunk analyses into a comprehensive `BookWiki` containing an overview, concepts, themes, people, chapter maps, notable quotes, open questions, and carry-forward insights.
- **Thread & Entity Maps (`thread_map`, `entity_map`)**: Tracks the lifecycle and evolution of narrative threads and entities across reading sessions.
- **Narrative Arc**: Records the progression of the book's core narrative state (`introduced`, `developing`, `resolved`, `uncertain`).

### 4. Cross-Book Connections
Beyond individual book wikis, OpenWiki synthesizes overarching connections across multiple books (`cross_book_connections.ts`). 
- **Source Gathering (`getCrossBookSource`)**: Aggregates reading logs, reading lens analyses, and book wikis for an owner across all their books.
- **Multi-Book Synthesis**: Generates overarching connections that cite evidence from at least two distinct books, producing a unified cross-book artifact (`CrossBookArtifact`).

## Invariants & Failure Handling
- **Resilient Batching**: AI Reader chunk batching (`AI_READER_BATCH_SIZE = 2`) processes multiple sessions concurrently while supporting automatic fallback to serial single-session analysis if a batch payload exceeds provider limits.
- **Strict JSON Parsing**: All LLM interactions enforce strict JSON object responses using shared JSON extraction utilities (`extractJson`) to prevent markdown preamble or trailing text corruption.
- **Companion Voice**: Automated prose generation applies strict formatting filters (`companionVoice`) to strip generic report lead-ins (e.g., "This passage discusses", "Đoạn văn giới thiệu"), ensuring a warm, direct reader-companion tone.
