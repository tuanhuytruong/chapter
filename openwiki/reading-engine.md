---
type: Reading Engine
title: Reading Engine
description: The core reading analytics, AI reader, and content processing engine.
tags: [reading, ai]
openwiki:
  roles: ["domain"]
  change_kinds: ["lifecycle"]
  source_paths: ["src/aiReader.ts", "src/extractor.ts"]
  validation_commands: ["npm test"]
---

# Reading Engine

The reading engine processes book chapters, extracts insights, generates AI summaries, and powers daily reviews.
- Entrypoints: `/src/aiReader.ts`, `/src/extractor.ts`
- Integrates with [Workflows](/openwiki/workflows.md) and [Data Model](/openwiki/data-model.md).
