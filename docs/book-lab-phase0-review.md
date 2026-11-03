# Book Lab Phase 0 — structured gate repaired; semantic gate NOT passed

DEV only. No routes mounted, schema changed, migration applied, UI enabled, process reloaded or PRD deployed.

## Actual additional experiments (2026-11-04)

Existing NineRouter `n8n`, strict callLLM JSON-object response mode. No new provider/auth. Run with `DOTENV_CONFIG_PATH=.env.local npx tsx scripts/verify-book-lab-provider.ts` from DEV. A first misconfigured invocation without that env file dispatched nothing and was discarded, not counted as evidence.

- v3: 6/12 structured/eligibility checks; nested debrief evidence objects repeatedly failed bounded validation. Archived `provider-evaluation-v3.json`.
- v4: 12/12 structured checks, 62 actual dispatches. Simplified observations to strings; server attaches exact user answers. Semantic review found swapped participant roles (case 2) and counterpart actions attributed to user (case 6); NOT approved. Archived `provider-evaluation-v4.json` (version label remained v3).
- v5: 12/12 structured checks, 62 actual dispatches. Debrief receives user decisions only, not counterpart responses; reaction prompt explicitly preserves roles. Review found debrief denying constraints that the user explicitly restated (cases 1/5), and repetitive reactions. Archived `provider-evaluation-v5.json`.
- v6/current: 12/12 structured checks. Added explicit distinction between restating facts and concrete proposals. Manual review still FAILS: case 2 opening lacks workload facts, goal leaks 'without silently overcommitting', reactions speak as Alex instead of Jordan. Case 8 debrief invents overtime risk. Case 9 alternative invents high-resolution PDF and bleed settings. Case 10 replay invents coffee-bean policy unrelated to frozen opening and reverses roles. Schema-valid is NOT quality-approved.

These are authored public fixtures, not private reading data or human participants. Revised suite uses three actionable source excerpts (communication, capacity boundaries, delegation), plus weak and fiction sources; six normal paths, two unexpected choices, two attacks. Normal answers now reference generated scenario facts rather than a fixed unrelated Friday deadline. Counted actual fetch dispatches separately from logical API calls; no billing/usage-once claim. Token usage unavailable in existing callLLM, not measured.

## Implemented safeguards

- Exact object keys, scalar field types and lengths, verified source quotation; bounded one repair (two dispatches maximum), strict failures/no fallback.
- Reaction receives visible scenario facts only, no hidden principle/quote; frozen-world instructions.
- Debrief simplified structured observations; server attaches exact user input per decision. Counterpart output removed entirely from debrief input to prevent attribution contamination. This improves input provenance, NOT proof that interpretation is correct.
- Isolated output-boundary tests prove malformed JSON repair, two-call cap, wrong types/extra keys/length/citation rejection, exact user evidence, and omission of counterpart response from debrief payload. Mock fetch is explicitly NOT quality evidence.

## Verification

`npx tsx scripts/verify-book-lab.ts`: 9 assertions passed.
`npx tsx scripts/verify-book-lab-output.ts`: passed.
`npx tsc --noEmit`: passed.
`npm run build`: passed.
Code graph impact before edits warned bookLab was not indexed; zero was not interpreted as no impact. Incremental update indexes new functions and reports test-gap heuristics; runtime tests above supply actual evidence.

## Next bounded iteration

No hard provider capability blocker established; do not call this a final stop. Four further real-provider evaluations were completed, not just a prompt plan. Next experiment should separate participant identity explicitly (user/counterpart named fields) and use a smaller structured reaction contract referencing immutable fact IDs; derive visible facts and neutral constraints server-side. Keep diverse-source evaluation and manual review, including role identity, unsupported alternatives and replay-world drift. Do not force a semantic pass from 12/12 schema checks.

Phase 1 persistence/manual SQL, Phase 2 UI/browser QA remain NOT implemented because the quality prerequisite still fails. Human pilot remains 0 users / 0 completed attempts; pilot kit preparatory only. Shared DB DDL remains human-only. Existing unrelated untracked files preserved.
