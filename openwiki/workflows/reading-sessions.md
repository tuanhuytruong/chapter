---
type: concept
title: Reading Sessions Workflow
description: End-to-end reading session lifecycle, text extraction, and reading modes including casual reading, deep reading, and story threads.
tags: [reading-sessions, ai-reader, extraction, story-threads, reading-lens]
verified:
  - by: openwiki/0.4.3
    at: 2026-08-29T19:44:06.027Z
sources:
  - id: openwiki-source-2595616fbfe0d9510c40d225
    resource: repo://src/aiReader.ts
  - id: openwiki-source-9d47595c2a2ea0b2c9b2cc8d
    resource: repo://src/api.ts
  - id: openwiki-source-a3f029feba00e1de286184bb
    resource: repo://src/extractor.ts
  - id: openwiki-source-46566cc7ea754e2f350a3165
    resource: repo://src/pdfExtractorWorker.mjs
  - id: openwiki-source-e78ec8b61a2adbf41642930e
    resource: repo://src/readingLens.ts
  - id: openwiki-source-778c364c9c8bbe2c782bb309
    resource: repo://src/storyThread.ts
generated: { by: "openwiki/0.4.3", at: "2026-08-29T19:44:06.027Z" }
---

# Reading Sessions Workflow

The OpenWiki reading sessions workflow manages the end-to-end lifecycle of ingesting documents (PDF and EPUB), extracting readable text, conducting interactive reading sessions across different modes (casual reading, deep reading, and story threads), and synthesizing insights into book wikis via the AI Reader.

```mermaid
sequenceDiagram
    participant User
    participant API as API Routes (/src/api.ts)
    participant Extractor as Text Extractor (/src/extractor.ts)
    participant Reader as AI Reader & Lens (/src/aiReader.ts, /src/readingLens.ts)
    participant DB as SQLite Storage (/src/db.ts)

    User->>API: Upload Document (PDF/EPUB)
    API->>Extractor: Extract chapters, text, and pages
    Extractor-->>DB: Store pages and text units
    User->>API: Start Reading Session / Request Chunk
    API->>Reader: Process reading range & analyze threads
    Reader-->>DB: Save chunk analysis & narrative state
    API-->>User: Return session state, lens, and story threads
```
<p align="center"><em>End-to-end reading session lifecycle and text extraction flow.</em></p>

## Reading Modes

OpenWiki supports multiple reading modes tailored to different engagement depths and narrative tracking needs:

- **Casual Reading (`src/aiReader.ts`)**: Focuses on high-level session summaries, quick takeaways, and maintaining a lightweight narrative thread without deep structural analysis.
- **Deep Reading (`src/readingLens.ts`, `src/aiReader.ts`)**: Employs reading lenses and close-reading analysis to extract substantive concepts, character pulses, notable quotes, and entity changes across chapters.
- **Story Threads (`src/storyThread.ts`, `src/aiReader.ts`)**: Tracks narrative arcs, thematic threads, and entity movements across multiple reading sessions, establishing continuity and connections as the book progresses.

## Document Extraction & Reading Units

Document extraction is handled by `src/extractor.ts` and associated worker scripts (such as `src/pdfExtractorWorker.mjs`):
- **PDF & EPUB Ingestion**: Automatically parses structure, table of contents, chapters, and page boundaries.
- **Reading Units**: Content is segmented into discrete pages and logical reading ranges (chunks) to ensure predictable LLM processing limits and maintain context window efficiency.

## End-to-End Workflow

1. **Initialization**: A book or document is uploaded and processed into structured pages via the extraction pipeline.
2. **Execution**: Users initiate reading sessions through API endpoints. The AI Reader (`src/aiReader.ts`) and Reading Lens (`src/readingLens.ts`) analyze text chunks, evaluating active threads, entities, and changes.
3. **Conclusion**: Session insights, summaries, and updated thread maps are persisted to SQLite (`src/db.ts`) and synthesized into the overall book wiki.
