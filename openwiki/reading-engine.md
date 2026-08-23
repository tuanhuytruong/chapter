---
type: Reading Engine
title: Reading Engine
description: The core reading analytics, AI reader, and content processing engine.
tags: [reading, ai]
openwiki:
  roles: ["domain"]
  change_kinds: ["lifecycle"]
  source_paths: ["src/aiReader.ts", "src/extractor.ts", "src/podcast/"]
  validation_commands: ["npm test"]
---

# Reading Engine

The reading engine processes book chapters, extracts insights, generates AI summaries, and powers daily reviews and automated podcast generation.

## Key Subsystems
- **AI Reader & Continuity Map**: Manages context, continuity v2 maps, and narrative expansion (`/src/aiReader.ts`, `/migrations/20260726_ai_reader_continuity_map_v2.sql`).
- **Extractor**: Parses uploaded documents and PDFs (`/src/extractor.ts`, `/src/pdfExtractorWorker.mjs`).
- **Podcast Generator**: Handles text-to-speech narration, round-based narrator configuration, and playlist synthesis (`/src/podcast/`, `/migrations/20260805_podcast_narrator_per_round.sql`).
- **Cross-Book Connections & Reading Lens**: Synthesizes insights across books (`/src/crossBookConnections.ts`, `/src/journeySynthesis.ts`).

Related concepts: [Workflows](/openwiki/workflows.md), [Data Model](/openwiki/data-model.md).
