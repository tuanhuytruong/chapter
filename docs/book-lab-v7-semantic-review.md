# Book Lab v7 semantic review — gate FAIL

DEV only; no routes/UI mounted, DB imports/DDL, reload, push or PRD changes.

## Changes
Explicit named USER/counterpart actors; sequential immutable fact IDs and owner tags. Opening/constraints derived from those facts server-side. Reaction contract validates speaker=COUNTERPART, existing fact IDs and clarify/resist/consider/propose transition. Only willingness/conditional proposals may change. Debrief requires existing fact IDs and verbatim per-answer evidence; counterpart responses remain excluded. Free-text human answers remain intact. At most one validation repair; strict existing callLLM/NineRouter, no fallback/new provider.

## Real evidence and budget
- Targeted cases 2/9/10: 18 actual fetch dispatches, 3/3 schema-valid, 25.319 seconds summed case durations. Roles improved and PDF/coffee drift absent in these samples. Manual FAIL: case 2 F1/F3 copy lesson instructions into visible facts; case 9 lacks actual handover object and copies checkpoint instruction.
- Added targeted prompt examples contrasting descriptive facts with source instructions plus narrow English instruction-leak validator. This regex is defense in depth, NOT a complete semantic validator or multilingual gate.
- One full 12-case round: 53 actual dispatches, 8/12 schema/eligibility passes; cases 2/3/4/9 exhausted bounded validation. Script currently reports generic failure, so exact stage/validator cause cannot be recovered from stored artifact. Do not invent a diagnosis. Persisted full artifact contains successful cases only; raw invalid outputs deliberately not logged.
- Total this repair: 71 actual provider dispatches, 1 targeted subset + 1 full round (not two full rounds). Token/currency usage unavailable, not measured. No more calls: regressions warrant design reassessment, not exhausting a second full round.
- Full run exceeded local 300-second SSH tool wait, but remote runner continued; polled read-only, did not relaunch. All 12 results and archived full artifact verified afterwards.

## Manual review of every surviving full-round case
1: Overall fact-grounded, user attribution correct, proposals conditional. Replay says “I need a full hour” for the user's audit work: ambiguous actor phrasing remains.
5: FAIL. Goal “without creating an unacknowledged workload conflict” leaks boundary lesson. Frozen fact says 30 minutes UNALLOCATED, yet reactions/replay say only 30 minutes remain today and imply report cannot receive required time. This is a material capacity interpretation error.
6: Mostly coherent roles, grounded alternative, no fabricated technical settings. Third observation says time limit unspecified although user quoted it in previous decision; within that exact decision it is unspecified, but wording needs temporal precision.
7: FAIL. First reaction invents user emotional state “I understand you are stressed”. No stress fact in opening or human answer. Subsequent resistance/debrief grounded.
8: Roles/constraints maintained; no overtime invented. Alternative asks scope/timing rather than guarantees outcome.
10: Roles maintained, attacks not credited, no coffee-policy drift. “our agenda” is minor inferred framing; not a verified immutable fact.
11/12: Weak and fiction sources correctly rejected.
2/3/4/9: Strict validation failure means unsuitable for release regardless of semantics of surviving cases.

## Verification
`npx tsx scripts/verify-book-lab.ts`: Book Lab validation: 9 assertions passed; no provider mocks counted.
`npx tsx scripts/verify-book-lab-output.ts`: BOOK_LAB_OUTPUT_BOUNDARY_OK. Added rejection of wrong speaker and unknown fact ID; mock fetch only.
`npx tsc --noEmit`: exit 0.
`npm run build`: exit 0; artifacts/book-lab/build-v7.log.
Pre-edit graph impact saved (16 directly changed nodes, stale graph warning; zero downstream not treated as no impact). Post-edit graph update completed in graph-update-v7.txt.

## Phase status / next design decision
Phase0 semantic prerequisite FAIL. Backend persistence, UI/browser QA and human pilot not implemented; human pilot 0 users/0 completed attempts. Shared dwh.chapter schema remains manual by Huy; no BookLab ensureSchema/bootstrap.
Recommended next bounded design: retain explicit identities and fact contract, but separate planner factual-world generation from lesson mapping, reject pedagogical visible goals as well as facts, preserve numeric qualifiers such as unallocated vs total remaining capacity, and return sanitized validation codes/stage to evaluator (never raw private outputs). Structured IDs constrain references, not semantic truth. Do not replace meaningful free-text practice with a quiz or claim a provider capability impossibility from these samples.
