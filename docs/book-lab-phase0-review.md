# Book Lab Phase 0 — gate NOT passed

Approved scope: DEV phases 0–3. Production deployment and shared database migration remain separate human gates.

## Actual provider evidence (2026-11-04)

- Existing NineRouter model from DEV configuration (`n8n`), strict `callLLM`; missing provider is an error, not fallback success.
- Original prompt: 12/12 cases failed structured/eligibility checks, 18 actual dispatches. Revised task placement: 9/12 structured checks passed, 47 actual dispatches. These are public, authored fixtures, not private reading data or human participants.
- Revised evaluation artifacts: `artifacts/book-lab/provider-evaluation.json`; original: `provider-evaluation-v1.json`; public raw responses: `public-fixture-raw.jsonl`.
- Repeated clear-source cases explore different provider outputs but are NOT twelve independent source books. Six normal, two unexpected actions, two instruction attacks, weak source, fiction. Three decisions plus debrief and one replay reaction were attempted for accepted scenarios.
- Calls are attempted dispatches, not logical commits. No persistence/usage charging exists yet. Token usage is not exposed by existing callLLM and was NOT measured. No once-only provider billing claim.

## Confirmed quality failures

1. Revised cases 1 and 2 returned malformed JSON (extra comma); case 5 returned array constraints instead of required string. Bounded schema repair remains unimplemented.
2. Manual review of revised case 10: all three user answers were instruction attacks, yet debrief praises the counterpart's collaborative behavior and suggests the exchange models the source principle. It fails to identify the user's actual observable decisions. A schema-valid debrief is not a quality pass.
3. Replay reaction introduces a regulatory update for another client that was not in the immutable original scenario. This is unsupported world-state drift, not meaningful counterfactual replay evidence.
4. Normal case 3 alternative says unilateral insistence 'avoids collaborative friction', an unsupported tradeoff. Scenario constraints sometimes prescribe the intended lesson instead of establishing neutral world constraints.

## Decision

Do NOT enable Book Lab, perform migration, expose routes, build full UI, or invite a pilot on this evidence. The plan's explicit Phase 0 quality gate is not satisfied. The module is unmounted and cannot receive user traffic. No shared schema changes were made. Existing app auth/access/paused policies are untouched.

Next experiment must freeze world-state facts, separate hidden lesson from visible constraints, require debrief evidence tied to exact user actions, add one bounded repair, evaluate diverse sources and automated factual consistency assertions, then manually review again. The current `passed` field means structured checks only, NOT product quality approval.

## Remaining phases

Backend persistence, manual migration SQL, feature flag/quota, UI, isolated API/race/privacy tests and browser feature QA: NOT IMPLEMENTED. They must not be represented as complete. Pilot kit is preparatory only; actual participants 0, completed attempts 0. PRD unchanged.
