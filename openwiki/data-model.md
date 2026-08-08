---
type: Data Model
title: Data Model
description: Database schema and SQLite data definitions for Chapter.
tags: [database, schema]
openwiki:
  roles: ["domain", "integration"]
  change_kinds: ["lifecycle"]
  source_paths: ["src/db/schema.sql", "src/db.ts"]
  validation_commands: ["npm test"]
---

# Data Model

The Chapter data model is backed by SQLite with migration files under `/migrations/`.

```erDiagram
    USERS ||--o{ BOOKS : reads
    BOOKS ||--o{ CHAPTERS : contains
    CHAPTERS ||--o{ NOTES : has
```

- Core tables include users, books, chapters, notes, podcasts, and billing records.
