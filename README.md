# Chapter — AI Daily Book Reading Companion

Chapter is a self-hosted reading companion for maintaining a personal library, recording reading sessions, and building a calm, source-grounded view of each book over time.

It supports PDF and EPUB books, session summaries, reading continuity tools, private chapter podcasts, and optional Telegram delivery. The app is designed so readers can share completed book artifacts safely while ownership-sensitive actions stay private.

**Stack:** React 19 + Vite + TypeScript · Express + TypeScript · PostgreSQL · OpenAI-compatible LLM/TTS providers · optional Telegram and automation integrations

---

## Features

- **Library and reading progress** — organize PDF and EPUB books, track reading state, queue books, and review progress at a glance.
- **Reading sessions** — extract the next reading unit, save a source-grounded summary, insights, quote, notes, and chapter context.
- **Reading modes**
  - **Casual Reading** for a concise companion recap.
  - **Deep Reading** for structured reflection.
  - **Story Thread** for fiction, following characters, events, and unresolved threads across sessions.
- **Reading Lens** — quiet per-session analysis and synthesis for connecting an evolving reading journey.
- **AI Reader** — a book-level reading map synthesized from persisted session text rather than raw uploaded files.
- **Chapter Podcast** — create an optional narrated episode for each EPUB chapter, play it in Book Detail, and archive audio privately.
- **Shared reading** — readers may view safe persisted companion artifacts on shared books; only the owner can mutate a book or regenerate analysis.
- **Reading rhythm** — calendar, streaks, goals, reviews, achievement milestones, and a focused Today view.
- **Optional delivery** — Telegram notifications and external schedulers can deliver daily summaries when configured.
- **Book covers** — optionally look up a cover while adding a book.

---

## Requirements

- Node.js 20+ and npm
- PostgreSQL 14+
- An OpenAI-compatible chat completion provider for summaries and analysis
- Optional: an OpenAI-compatible speech provider for chapter podcasts
- Optional: Telegram Bot API credentials and an external scheduler for notifications
- Optional: PM2 or another process manager for production

---

## Quick Start

### 1. Clone and install

```bash
git clone <your-repository-url> chapter
cd chapter
npm install
```

### 2. Configure the environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your own values. Keep this file private; it is ignored by Git.

At minimum, configure:

```env
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<database>
NINE_ROUTER_URL=https://<llm-provider>/v1/chat/completions
NINE_ROUTER_MODEL=<model-id>
NINE_ROUTER_API_KEY=<provider-api-key>
SESSION_SECRET=<long-random-secret>
CHAPTER_BOOKS_DIR=/absolute/path/to/book-storage
PORT=3000
```

For production, review every variable in [`.env.example`](.env.example), especially session security, provider limits, upload storage, optional Podcast settings, and optional Telegram settings.

### 3. Run locally

```bash
npm run dev
```

Open the local URL printed by the server. On first boot, the application creates its required tables in the configured PostgreSQL schema.

### 4. Build for production

```bash
npm run build
npm start
```

The build outputs the web client and the bundled Express server under `dist/`.

---

## Production Deployment

The repository includes an example PM2 configuration and a deployment helper. Adapt hostnames, paths, reverse proxy settings, and process-manager settings to your environment.

```bash
npm install
npm run build
pm2 start ecosystem.config.cjs --env production
pm2 save
```

For a repeatable update on a host already configured for this project:

```bash
bash update.sh
```

`update.sh` pulls the selected branch, builds the app, reloads PM2 with the release environment, verifies the app process, checks core database relations including Podcast storage, and checks `GET /health`.

Place the application behind an HTTPS reverse proxy in production. Do not expose PostgreSQL, provider credentials, Telegram credentials, or private audio archive identifiers to browser clients.

---

## Optional Integrations

### Telegram notifications

Configure `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` to send daily reading notifications. The bot token remains server-side.

### Chapter Podcast archive

Podcast playback is provided in Book Detail. If a private archive is enabled, configure:

```env
PODCAST_TELEGRAM_ARCHIVE_CHAT_ID=<private-chat-or-channel-id>
PODCAST_CACHE_DIR=/absolute/path/to/podcast-cache
PODCAST_TTS_URL=https://<speech-provider>/v1/audio/speech
```

The archive destination and all credentials are backend-only. Shared readers can play already-persisted episodes, but cannot create, retry, or regenerate them.

### Scheduled automation

You may use n8n, GitHub Actions, a system scheduler, or another automation system to invoke the application's reading and notification flows. The included OpenWiki workflow checks out and updates the `dev` branch explicitly; scheduled GitHub Actions definitions must also exist on the repository default branch to run on a cron schedule.

---

## Development Commands

```bash
npm run lint                   # TypeScript type check
npm run build                  # Production client and server build
npm run verify:podcast         # Podcast routes, privacy, playback, and prompt fixtures
npm run verify:phase1          # Core pg-mem integration fixtures
npm run verify:reading-lens    # Reading Lens fixtures
npm run verify:story-thread    # Story Thread fixtures
npm run verify:ai-reader       # AI Reader fixtures
npm run verify:reading-rhythm  # Calendar, goals, and rhythm fixtures
npm run verify:read-today      # Reading-session workflow fixtures
```

Before shipping a change, run the relevant focused verifier plus:

```bash
npm run lint
npm run build
git diff --check
```

---

## Project Structure

```text
chapter/
├── server.ts                 # Express entry point
├── src/
│   ├── pages/                # Library, Book Detail, Today, Login, and related views
│   ├── components/           # Reading UI, companion artifacts, podcast player, and controls
│   ├── routes/               # HTTP routes and ownership-protected mutations
│   ├── podcast/              # Episode generation, archive handling, and narration prompts
│   ├── extractor.ts          # PDF and EPUB extraction / reading-unit indexing
│   ├── llm.ts                # OpenAI-compatible LLM client and provider scheduling
│   ├── db.ts                 # PostgreSQL access and schema bootstrap
│   └── config.ts             # Server-side environment configuration
├── scripts/                  # Deterministic verification scripts
├── n8n/                      # Optional automation workflow export
├── ecosystem.config.cjs      # Example PM2 process configuration
├── update.sh                 # Deployment/update helper
└── .env.example              # Safe environment template
```

---

## Security and Data Boundaries

- Keep `.env.local`, provider keys, bot tokens, database credentials, and private archive identifiers out of Git.
- Uploaded books and raw session text stay server-side; shared views expose only deliberately projected, safe persisted artifacts.
- Owner-only actions include book mutations, advancing reading, retries, regeneration, and personal notes.
- Use a strong unique `SESSION_SECRET` in production and terminate TLS at a trusted reverse proxy.
- Back up PostgreSQL and uploaded-book storage according to your retention policy.

---

## Troubleshooting

| Symptom | Suggested check |
|---|---|
| Database unavailable | Confirm `DATABASE_URL`, database reachability, and schema permissions. |
| Provider request fails | Confirm the chat-completion URL, model ID, API key, timeout, and rate-limit settings. |
| EPUB chapter data is missing | Confirm the file is readable by the application process and is a valid EPUB. |
| Podcast is unavailable | Confirm the book is EPUB, the speech provider is configured, and any private archive bot can post to its destination. |
| Telegram notification is not sent | Confirm the bot token, target chat ID, bot permissions, and scheduler configuration. |
| Session/login problems | Confirm `SESSION_SECRET`, production cookie/TLS settings, and reverse-proxy forwarding. |

---

## License

This project is private unless its repository owner publishes a license.
