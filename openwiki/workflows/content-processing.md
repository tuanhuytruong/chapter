---
type: workflow
title: Content Processing & Podcasts
description: End-to-end workflows for uploading EPUB and PDF content, managing books and reading rounds, and generating or verifying AI podcast episodes.
tags: [workflows, content, upload, podcasts, reading]
verified:
  - by: openwiki/0.4.0
    at: 2026-08-26T19:17:20.603Z
sources:
  - id: openwiki-source-6251e90fd58f3c041d6f5c9b
    resource: repo://scripts/verify-podcast.ts
  - id: openwiki-source-13927404d8ceb664565801bb
    resource: repo://scripts/verify-upload-content.ts
  - id: openwiki-source-e6ae3303314e5a8bb9e4bde3
    resource: repo://src/podcast/generate.ts
  - id: openwiki-source-3a9f5ed6f801cb82536e8136
    resource: repo://src/podcast/tts.ts
  - id: openwiki-source-88482dcd95c70813a5dd01c1
    resource: repo://src/routes/podcasts.ts
  - id: openwiki-source-8536bfae8360377e8c22add2
    resource: repo://src/routes/upload.ts
generated: {by: "openwiki/0.4.0", at: "2026-08-26T19:17:20.603Z"}
---

# Content Processing & Podcasts

The OpenWiki content processing and podcast generation pipeline handles importing reading material, validating formats, tracking reading progress, choosing podcast narrators, and synthesizing/archiving audio episodes.

## Content Upload & Validation

When users upload books (EPUB or PDF), the system validates file integrity, extracts text, repairs mojibake filenames, and persists standardized assets.

```mermaid
sequenceDiagram
    participant User
    participant UploadRoute as Upload Route
    participant Validator as Book Upload Validator
    participant Storage as File Storage / DB

    User->>UploadRoute: POST /api/books (Multipart File)
    UploadRoute->>Validator: validateBookUpload(file)
    alt PDF
        Validator->>Validator: Check PDF header & text extraction
    else EPUB
        Validator->>Validator: Inspect ZIP container & required structures
    end
    Validator-->>UploadRoute: Return validated format ('pdf' | 'epub')
    UploadRoute->>Storage: Store file with normalized ASCII name
    UploadRoute-->>User: 201 Created (Book metadata & ID)
```
*Content upload and validation flow.*

- **Upload Verification**: Files are checked via `validateBookUpload` in `src/routes/upload.ts` (tested by `scripts/verify-upload-content.ts`). PDFs are verified for selectable text (rejecting scanned image-only PDFs), and EPUBs are validated as proper ZIP containers with required manifest entries.
- **Filename Sanitization**: Unicode and Latin-1 mojibake filenames are repaired via `displayUploadFilename` and stored deterministically as clean ASCII via `storedUploadFilename`.

---

## Podcast Generation, Narrator Selection & Workflow

Podcasts can be generated for indexed EPUB books. Each reading round maintains its own persistent narrator choice (female or male).

```mermaid
sequenceDiagram
    participant User
    participant PodcastRoute as Podcasts Route
    participant Generator as Podcast Generator
    participant LLM as LLM Script Generator
    participant TTS as Edge TTS / Audio Engine
    participant Telegram as Telegram Archive

    User->>PodcastRoute: POST /api/podcasts (book_id, chapter_key, voice_gender)
    PodcastRoute->>Generator: createPodcast(...)
    Generator->>Generator: Check/persist round narrator & chapter source
    Generator->>LLM: Generate standalone podcast script
    LLM-->>Generator: Raw spoken prose script
    Generator->>TTS: Synthesize audio (synthesizePodcast)
    TTS-->>Generator: Audio file & duration
    Generator->>Telegram: Archive episode (archivePodcast)
    Telegram-->>Generator: Telegram file IDs & message metadata
    Generator-->>PodcastRoute: Ready episode with local cache & playback status
    PodcastRoute-->>User: 202 Accepted / Episode metadata
```
*Podcast generation and archiving workflow.*

- **Narrator Persistence**: The narrator voice (`female` or `male`) is bound per `(book_id, reading_round)`. Re-reading a book initiates a fresh session where the voice picker can be re-invoked.
- **Language Auto-Detection**: `resolvePodcastLanguage` inspects chapter text for diacritics and linguistic signals to automatically determine whether to generate Vietnamese or English audio.
- **Brief Chapter Handling**: Chapters with very few words are marked as `unavailable` (`isPodcastSourceTooBrief`), triggering automated skipping to the next eligible chapter.
- **TTS Retry & Recovery**: Upstream TTS errors are classified by `isRetryableTtsError` and retried using durable bounded budgets (`recoverRetryablePodcastTts`). If Telegram archiving fails, episodes enter an `archive_pending` state while preserving local cache playback.

---

## Reading Progress & Playback

- **Progress Tracking**: Users can update resume cursors and completion marks via `/api/podcasts/books/:bookId/playlist/progress`.
- **Audio Streaming**: Audio proxy endpoints support standard HTTP Range requests (`bytes=...`) for smooth scrubbing and seeking during playback.
