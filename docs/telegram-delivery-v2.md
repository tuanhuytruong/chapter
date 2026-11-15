# Telegram delivery V2

## Operator gates

Migration `migrations/2026-11-15-telegram-delivery-v2.sql` is manual-only. Do not add it to startup. Have the database owner review and run it; DEV and PRD share the database. The transaction uses 3-second lock and 30-second statement timeouts and adds indexes to users/books (review table size first). On timeout roll back and schedule a maintenance window. Do not drop/reset delivery history.

Configure `TELEGRAM_ENV=dev` (must match APP_ENV), HTTPS `TELEGRAM_CHAPTER_ORIGIN`, and bot credentials using existing secret plumbing. Sender and scheduler default OFF. Missing/invalid explicit environment disables V2; missing tables return unavailable without startup DDL. Setting flags does not change webhook. A bot has exactly one webhook: do not repoint the production bot to DEV. Use an approved dedicated QA bot and synthetic destinations.

Activation needs manual schema verification, independent QA acceptance, approved private/group/two-topic/channel test destinations, and separate enablement approval. PRD deployment is separate. Legacy chat-only identities must reconnect. Activation watermark excludes sessions created before destination activation; there is no historical backfill.

## Reader setup

Account → Telegram identity → Connect → open bot and Start in private chat. Numeric from.id authenticates identity, not username. Tokens are SHA-256 only, expiring and one-use. Disconnect revokes destinations and disables subscriptions. A new link does not share any books.

Create a bind code on the web and run `/chapter_bind@Bot <code>` inside the actual group/topic. Manager must be a linked numeric sender and actual administrator. Anonymous admins cannot bind. For channels verify on the web, inspect the pending label, then explicitly confirm. Bot posting rights and manager membership are checked again before activation and delivery.

Select specific books per destination, acknowledge that destination members can retain the private summaries, set IANA timezone/time, and enable subscription. Sender switch is independent. Revocation cannot recall an already-dispatched or delivered message.

Commands: `/chapter_help`, `/chapter_books`, `/chapter_send <book-code>`, `/chapter_status`. Group listings include only explicitly granted books in that topic. Private send can append a managed destination UUID to select a channel. Channel posts never authenticate the manager.

## Delivery semantics

Existing ready summaries only: no LLM generation or book advancement. Current local day/current reading round, all sessions ordered deterministically. Scheduler reconciles every 30 seconds after the due time through midnight, including late-ready summaries. DST gaps use the next valid wall minute, folds first occurrence. No previous-day backlog. Sender-only claims expire prior-day jobs and scrub their payloads; every part's fenced authorization checks its current local day. Today's persisted next_run_at is the due cursor retained for late-ready reconciliation; stale cursors advance to today's configured wall time rather than replaying yesterday.

Manual/commands/scheduled/legacy notify all enqueue the durable outbox. Stable environment+canonical chat/topic+reading log+round dedup survives destination UUID recreation and content edits. HTML escapes untrusted content, splits at grapheme boundaries and reserves header space below 3500 decoded UTF-16 units.

Claims use SKIP LOCKED and fenced leases. Each part is durably sending before dispatch. Confirmed message IDs are never replayed. Timeout, 5xx, interrupted sending or unconfirmed DB outcome becomes `unknown`, not automatic retry. An unknown part blocks subsequent parts. Inspect Telegram then acknowledge delivered without inventing a message ID, or explicitly accept duplicate risk before retry. Definite 429 respects shared cooldown; definite parse rejection may fallback to plain text for that unsent part only. Best-effort dedup is not exactly-once.

Dispatch uses a bot-scoped PostgreSQL session advisory lock (no transaction held across network), with guard rechecks after pacing waits and durable cooldown checks after slow guards. Completion extends pacing conservatively; this serializes the bot and trades throughput for safety. Waiters release pool connections between lock attempts. Process/session loss releases the lock; durable sending remains ambiguous, never automatically replayed. All bot-sharing deployments must run this coordinator version before activation. Rate coordination is bot-wide across environments, >=1050ms/private chat and >=3100ms/group chat (topics share chat quota), <=20/s/bot. No legacy book direct-send path remains.

**Compatibility contract (not an unconditional shared-limiter guarantee):** feedback and podcast archive use the durable coordinator when an explicit valid matching `TELEGRAM_ENV`, bot token and all V2 tables are available. Sender/scheduler OFF does not disable these existing internal notifications. Missing/invalid/mismatched environment returns no V2 service; missing/partial schema returns not-ready. In either case these two internal paths retain their existing direct transport, with no durable shared reservation/cooldown. A readiness query failure or coordinated-send failure is caught as a safe notification error, not retried through direct transport. Therefore migration plus valid configuration is a prerequisite for the cross-path bot-wide quota guarantee. Do not enable V2 on a shared bot while another deployment still uses this compatibility bypass. Existing destination/thread/media semantics remain unchanged; this exception never authorizes book summary sends.

Startup OFF skips DB readiness and all Telegram timers. Enabled startup with unavailable DB/schema or invalid HTTPS origin disables background capability without preventing application health. Scheduler-only currently performs cleanup but does not enqueue while sender is OFF. Shutdown synchronously fences new claims/parts and awaits the in-flight tick for at most 12 seconds; an already dispatched request cannot be recalled. The isolated runtime loop has no config/bootstrap imports.

Unknown snapshots expire after seven days while the metadata ledger survives; retry is rejected when payloads were scrubbed. Revocation/pause/grant removal clears all affected snapshots, including later parts; in-flight sending is retained as unknown rather than falsely declared unsent. Destination removal cancels only that destination, disconnect remains owner-wide. Delivered resolution is restricted to unknown outcomes, never definite failed parts.

## Bootstrap incident (pre-review fixture)

A prior fixture was mistakenly launched from the deployment cwd and inherited live dotenv configuration. Retained output confirms completion of the write-capable core bootstrap loop (199 statements), including global books-round UPDATE, missing round-history INSERT and book_wiki language UPDATE, before EADDRINUSE. No row counts/before-state exist: possible core schema/data effects cannot be excluded. Pre-listen podcast maintenance was reachable; actual progress/provider effects are unknown. No evidence-based rollback was available or performed. This was not a mutation-free test. All subsequent fixture boots must use an empty scratch cwd, absolute bundle and sealed synthetic environment; DB fixtures import only isolated modules, never application startup.

## Rollback

Disable sender and scheduler, stop claims, preserve ledger and unknown outcomes. Restore reviewed code only; never silently re-enable the legacy book sender. Do not delete tables/history to resolve a retry. Keep credentials and private content out of logs and evidence.

## Evidence

Run each verifier independently. `TELEGRAM_TEST_DATABASE_URL` accepts only the explicit local disposable `telegram_v2_fixture` database on port 55439; it never reads live configuration. Fixtures destructively reset that disposable schema. Browser fixture uses intercepted synthetic data only; it does not prove live Bot API/webhook acceptance or authenticated deployed UI.
