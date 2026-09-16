---
type: concept
title: Reading Sessions
description: Guide to understanding how reading progress is tracked in OpenWiki.
tags: [reading-sessions, progress-tracking]
verified:
  - by: openwiki/0.5.2
    at: 2026-09-16T20:06:06.880Z
sources:
  - id: openwiki-source-2595616fbfe0d9510c40d225
    resource: repo://src/aiReader.ts
  - id: openwiki-source-9d47595c2a2ea0b2c9b2cc8d
    resource: repo://src/api.ts
  - id: openwiki-source-ddf75957c1dba6e13c946ffe
    resource: repo://src/components/ReadingProgressCard.tsx
  - id: openwiki-source-70d4664310eebb80ab5b564c
    resource: repo://src/db.ts
  - id: openwiki-source-a3f029feba00e1de286184bb
    resource: repo://src/extractor.ts
  - id: openwiki-source-46566cc7ea754e2f350a3165
    resource: repo://src/pdfExtractorWorker.mjs
  - id: openwiki-source-e78ec8b61a2adbf41642930e
    resource: repo://src/readingLens.ts
  - id: openwiki-source-778c364c9c8bbe2c782bb309
    resource: repo://src/storyThread.ts
generated: { by: "openwiki/0.5.2", at: "2026-09-16T20:06:06.880Z" }
---

# Reading Sessions

Reading sessions in OpenWiki are the primary way users interact with their documents, enabling tracked progress through the material and continuous refinement of narrative understanding.

## Progress Tracking Workflow

The core of progress tracking relies on the `ReadingProgressCard` component, which surfaces processed insights and reading milestones back to the user.

1. **Ingestion & Processing**: As documents are read, the system tracks progress via sessions. Each session records a range of pages and maps them to narrative threads or thematic updates. The `aiReader.ts` orchestrates chunk analysis and wiki synthesis, ensuring that reading data is structured and persistent.
2. **Component Rendering**: The `src/components/ReadingProgressCard.tsx` component is responsible for displaying the progress. It receives the following data:
   - `companion`: Data from `ReadingProgressCompanionRow` that contains summarized insights, story threads, and narrative status.
   - `logs`: Historical record of reading activity.
3. **User Interaction**:
   - Users can refresh progress data via `onRefresh`.
   - Clicking on specific reference buttons within the progress card (rendered by the `Refs` sub-component in `src/components/ReadingProgressCard.tsx`) triggers `onOpenReadingSession`, allowing users to jump back to specific reading logs.

## Technical Details

The `ReadingProgressCard` and session management rely on the following mechanisms:
- **API & Persistence**: Reading progress is managed through API endpoints defined in `src/api.ts`, which interface with the persistent state stored in SQLite via `src/db.ts`.
- **Reference Resolution**: Each reading insight is anchored to specific reading logs (`LogRow`), allowing navigation between summary points and the actual text segments they refer to.
- **Glossary Tooltips**: Provides context for categories like "Story so far" and "Narrative arcs", ensuring users understand the tracking logic.
- **State Integration**: The system integrates with the broader reading companion service (`readingProgressCompanionPresentation.ts`) to calculate progress states and coverage.

```mermaid
graph TD
    A[User Reading Session] --> B{AI Reader}
    B -->|Chunk Analysis| C[Reading Logs]
    C -->|Store/Update| D[(SQLite DB)]
    D -->|Query/Fetch| E[Reading Progress Companion]
    E -->|Render| F[Reading Progress Card]
    F -->|User Refresh/Interact| G[API Routes]
    G -->|Update State| D
```
