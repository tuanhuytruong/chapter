---
type: concept
title: Workflow Overview
description: High-level guide to the primary user-facing workflows in the system.
tags: [workflow, overview]
verified:
  - by: openwiki/0.5.0
    at: 2026-09-09T19:45:31.755Z
sources:
  - id: openwiki-source-2595616fbfe0d9510c40d225
    resource: repo://src/aiReader.ts
  - id: openwiki-source-70d4664310eebb80ab5b564c
    resource: repo://src/db.ts
  - id: openwiki-source-a3f029feba00e1de286184bb
    resource: repo://src/extractor.ts
  - id: openwiki-source-c0912ceeea70ad7f18d724c1
    resource: repo://src/readingProgressCompanion.ts
generated: { by: "openwiki/0.5.0", at: "2026-09-09T19:45:31.755Z" }
---

# Workflow Overview

This document provides a high-level overview of the major user-facing workflows within the system. It describes the lifecycle of data from storage to user interaction, including how sessions are managed and how content is processed.

## Data Flow
The system manages data flow by synchronizing information from persistent storage (database) to the UI components.
1. **Database Layer**: Core data (content, reading progress, AI-generated insights) is stored and retrieved.
2. **Application Layer**: Business logic handles session management and transformation of raw content into structured narratives.
3. **UI Layer**: React components consume the processed data to present content and interact with the user.

## Key Workflows

### 1. Reading Sessions
Reading sessions are the primary mechanism for tracking user engagement with content. They record start/end times, current position, and active focus.
- **Initialization**: Triggered when a user opens a piece of content.
- **Persistence**: Periodic updates to the database ensure progress is saved.

### 2. AI-Reader Narratives
The AI-reader enhances content consumption by generating synthetic narratives or summaries.
- **Request**: User initiates the generation via the interface.
- **Processing**: The system fetches content, applies prompts, and streams the AI output back to the UI.

### 3. Content Processing
Content processing involves the ingestion and transformation of media/text into a consumable format.
- **Ingestion**: Raw content is stored.
- **Normalization**: Content is parsed and structured.
- **Enrichment**: Metadata and AI-generated segments are added.

```mermaid
graph LR
    DB[(Database)] --> App[Application Logic]
    App --> UI[User Interface]
    UI --> App
```
