---
type: Data Model
title: Data Model
description: Database schema and SQLite data definitions for Chapter.
tags: [database, schema]
openwiki:
  roles: ["domain", "integration"]
  change_kinds: ["lifecycle"]
  source_paths: ["src/db/schema.sql", "src/db.ts", "migrations/"]
  validation_commands: ["npm test"]
---

# Data Model

The Chapter data model is backed by SQLite with migration files under `/migrations/`. Recent migrations add tables for MB VietQR billing, membership tiers, user lifecycle tracking, cross-book connections, and podcast round narration.

```erDiagram
    USERS ||--o{ BOOKS : reads
    BOOKS ||--o{ CHAPTERS : contains
    CHAPTERS ||--o{ NOTES : has
    USERS ||--o{ MEMBERSHIP_BILLS : pays
    BOOKS ||--o{ CROSS_BOOK_CONNECTIONS : links
```

- **Core Tables**: Users, books, chapters, notes, reading rounds, podcasts, and daily reviews.
- **Membership & Billing**: Tables tracking MB VietQR checkouts, transaction status, and entitlements (`/migrations/20260801_add_mb_vietqr_billing.sql`, `/migrations/20260801_add_membership_tables.sql`).
- **User Lifecycle Tracking**: Records user milestone progression and analytics (`/migrations/20260823_add_user_lifecycle_tracking.sql`).

Related concepts: [Architecture Overview](/openwiki/architecture/overview.md), [Operations](/openwiki/operations.md).
