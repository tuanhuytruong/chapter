# Podcast TTS and ffmpeg recovery Implementation Plan

> **For Hermes:** Implement task-by-task after Huy approves; run impact analysis before editing.

**Goal:** Recover DEV podcast synthesis with verified upstream diagnostics and a working multi-part audio pipeline, without regenerating saved scripts.

**Architecture:** Separate upstream request failures from local audio-assembly failures. Keep the configured 12000-char setting unchanged pending a validated request-size strategy; do not treat a single successful short probe as proof the service is healthy.

**Tech Stack:** TypeScript, Node fetch, NineRouter Edge TTS, ffmpeg, PostgreSQL, PM2.

## Verified evidence
- DEV checkout ab0ebad; no tracked changes at inspection. Preserve existing untracked files.
- ffmpeg absent from /usr/bin and /usr/local/bin and not found by command -v.
- src/podcast/tts.ts invokes ffmpeg only for >1 part. All part files are removed in finally, including after an assembly error.
- Episode 880af398-2e44-47cb-a2f8-2bef8d5acbb9 belongs to DEV, failed after 6 retries; saved script is 5190 chars.
- Direct request with same voice: 46 chars -> HTTP 200, audio/mp3, 17568 bytes; 5190 chars -> Cloudflare HTML 502 in 1283ms.
- Exact sentence splitting at 3500 yields 3262/1919 chars: first -> 502, second -> fetch failed.
- At 1000 yields 974/833/902/868/979/621 chars: five -> HTTP 200 audio; 902-char part -> fetch failed.
- Thus request size sensitivity is plausible, but transport/upstream instability also exists. No exact provider limit or upstream crash cause has been established.
- Current diagnostics collapse fetch/timeouts/invalid audio into generic retryable TTS error, and recovery logging reports only status 0 for those failures.

## Task 1: Identify upstream/transport cause
- Inspect NineRouter service and reverse-proxy logs for these requests using authorized host access; never expose API keys or script contents.
- Repeat a bounded matrix using the exact failed part, full script and short control, recording only length, elapsed time, status, safe cause code, content type and provider request ID.
- Determine service limit versus connection failure; prefer fixing proven upstream defect over lowering chunk size arbitrarily.

## Task 2: Repair and preflight assembly dependency
- Verify runtime PM2 executable search path without dumping environment secrets.
- Install ffmpeg through the host's supported package manager after approval; this host-wide dependency also exists outside DEV, so do not claim PRD is unaffected at OS level.
- Modify src/podcast/tts.ts to preflight ffmpeg when multiple chunks are required before calling paid/upstream TTS; emit a clear local dependency error.
- Document dependency in existing deployment documentation (discover exact path before edit).
- Add scripts/verify-podcast-tts.ts with single-part bypass, multi-part success, missing executable and nonzero exit cases.

## Task 3: Reliable TTS and safe diagnostics
- Files: src/podcast/tts.ts, src/podcast/generate.ts, tests above; src/config.ts only if evidence supports a new bounded parameter.
- Preserve status and a safe error category (HTTP, transport, timeout, audio validation, local assembly), chunk index/count/length and elapsed time. Do not log private text, tokens, headers or raw response bodies.
- Fix retry loop so permanent 4xx stops immediately rather than issuing four requests.
- Choose bounded/adaptive splitting only after evidence from task 1; do not change LLM prompt or regenerate script.
- Cover retryable HTTP, transport failure, permanent HTTP, malformed audio, mid-chunk failure, assembly failure and cleanup with deterministic mocks.
- Review source/build parity before editing: source inspection displayed an invalid Authorization call token; verify on-disk bytes, compiler result and deployed bundle before drawing conclusions.

## Task 4: Validate DEV recovery end-to-end
- Run code-review-graph impact --file for touched files, focused new tests, existing podcast/recovery tests, npm run verify:podcast, npm run verify:podcast-book-status, npm run lint, git diff --check, npm run build, npm run perf:audit:assets.
- Update graph; review final diff; commit only intended paths; push origin/dev and deploy DEV exact commit.
- Retry the failed DEV episode once using existing saved script and owner/environment fencing. Do not reset all failed episodes or alter PRD data.
- Verify script hash unchanged, successful audio assembly, duration/playability and archive ready or locally playable archive_pending. Verify authenticated UI playback and DEV health.
- No PRD code deployment without approval. No schema migration anticipated.

## Acceptance
- Real multi-chunk output passes ffprobe and plays.
- Missing ffmpeg detected before upstream synthesis.
- Failed upstream chunk produces actionable safe logs and bounded retry, keeping script intact.
- Exact problematic episode recovers without LLM/script regeneration, or report upstream blocker honestly with evidence.

## Status
Investigation and plan only. No application code, configuration, database rows, packages or running services modified. Probes called the actual TTS service but discarded returned audio.

## Execution
- [x] Impact review, deterministic regressions, lint/build/assets.
- [x] Source bytes and compiler confirm Authorization display was redaction, not corruption.
- [x] NineRouter provider source embeds raw text in SSML. Exact saved script contains one ampersand; raw request gives Bing 500, XML-escaped full text produced decodable audio. Added Edge-specific XML escaping. Transport instability is separate.
- [x] sudo unavailable; user-owned ffmpeg-static installed and DEV-only FFMPEG_PATH configured. No OS package or PRD configuration changed.
- [x] Exact DEV episode recovered ready; SHA256 8c3047f02f46a423abfd10f90c12251c9058cd1cfff65cacf4daa12a34690647 unchanged; 1140624 bytes, full ffmpeg decode passes.
- [x] Existing archive retry/cache maintenance reads now fenced to environment and owner before DEV restart.
- [x] Commit 356ad35 pushed origin/dev; chapter-dev restarted (PRD untouched). Public /health returns 200 {ok:true}.
- [x] Vault-authorized DEV browser: recovered audio Range 206 bytes 0-1023/1140624; UI Play selects exact episode; paused=false, currentTime=21.553109, duration=285.156, readyState=4, no media error. Paused QA at 38.48 seconds before next-generation threshold.
- [x] Real six-part synthesis using exact saved script and same voice via loopback NineRouter: chunks 974/833/902/868/979/621; 1143872-byte concatenated MP3 fully decodes. This probe changes no configuration or DB data and deletes its output.
- [x] All focused checks/lint/build/assets passed; existing book-status verifier updated to permit the added stop-after-current guard while retaining canGenerate requirement. Existing pg-mem podcast fixture emits known missing lifecycle/subscription table warnings but exits successfully.
- [x] OS ffmpeg install blocked by sudo authentication; user-owned fallback works. Public NineRouter still intermittently 502/ETIMEDOUT; no upstream service changed.
