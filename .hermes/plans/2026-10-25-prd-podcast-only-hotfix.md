# Approved PRD podcast-only hotfix

| Task | Status | Verification |
|---|---|---|
| Inspect divergent master and minimal dependencies | done | Preserve endpoint migration and advisory-lock bootstrap |
| Extract TTS + generation environment/lease safety | done | No UI, summaries, schema, whole merge or DEV mutation |
| Read-only schema gate + deterministic/audio gates | done | Existing shared columns only, no DDL |
| Build, push master, restart PRD, verify health | pending | Exact SHA, listener 3000, external health |

Scope: src/podcast/tts.ts, src/podcast/generate.ts, one podcast lease configuration property, regression verifier and this plan. Keep max chars 12000 and public endpoint. Set only PRD FFMPEG_PATH to verified user-owned DEV binary. Synthetic multipart synthesis/decode only; no episode creation, requeue, or private-data mutation. Upstream transport/502 and duration estimation are not fixed guarantees.

## Verified release gates
- CRG built on PRD; impact inspected before every source/verifier update; update --brief passed.
- Existing worker lease and TTS recovery columns verified read-only; no migration or DDL executed.
- verify-podcast-tts: all failure classifications, cleanup, multipart decode and adaptive split passed.
- verify:podcast passed (pg-mem emits existing lifecycle/subscription fixture warnings).
- verify:podcast-book-status passed after taking its DEV one-line contract fix; no UI change.
- lint, diff --check, build, perf:audit:assets passed.
- Real public Edge ampersand smoke: 1125 chars, two chunks, 370448 bytes, 5888ms, ffmpeg decode exit 0. No episodes created or requeued.
- PRD-only endpoint migration and advisory bootstrap files unchanged; DEV untouched.
- Deploy/push and postrestart health to be recorded in release handoff.
