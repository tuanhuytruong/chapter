# Chapter — AI Daily Book Reading Companion

Self-hosted web app that manages a personal book library, tracks daily reading
progress book-by-book, and automatically delivers AI-generated summaries via a
cron job (n8n) pushed to Telegram every morning.

**Stack:** Vite + React 19 + TypeScript (frontend) · Express + TypeScript (backend)
· PostgreSQL · 9router (LLM, Qwen3) · n8n · Telegram Bot

---

## ✨ Features

- 📚 **Library** — grid of book cards with cover, progress bar, streak 🔥, status badge
- 🔍 **Filter + Sort + Search** — All/Active/Finished/Paused, sort by recent/title/progress/streak
- 📖 **Book Detail** — reading-log timeline (one card per day), expandable raw text,
  streak heatmap (GitHub-style), edit/delete book
- 🤖 **AI Daily Summary** — extract next chunk (PDF/EPUB) → 9router → save summary,
  key insights, quote
- ⚡ **Read Today** — manual trigger on Book Detail + **Read All Today** bulk button
- 📨 **Telegram Delivery** — n8n cron (07:00) advances all active books, then pushes
  formatted summaries to your Telegram chat
- 🖼 **Auto Cover** — fetch book cover from Open Library when adding a book
- 💬 **Community feed** (base feature, kept as-is)

---

## 🗂️ Project Structure

```
chapter/
├── server.ts                 # Express entry (serves API + built frontend)
├── dist/server.mjs           # Built backend (ESM)
├── src/
│   ├── App.tsx               # Router (Library / BookDetail / Community)
│   ├── api.ts                # Frontend API client + helpers
│   ├── config.ts             # Centralized env config
│   ├── db.ts                 # PostgreSQL pool (injectable)
│   ├── db/schema.sql         # book + reading_log schema (chapter schema in dwh)
│   ├── extractor.ts          # PDF (pdf-parse) + EPUB extraction
│   ├── llm.ts                # 9router client + summary parser
│   ├── telegram.ts           # Telegram push + message formatter
│   ├── routes/books.ts       # All book + reading-engine API routes
│   ├── pages/                # Library, BookDetail, Community
│   ├── components/           # BookCard, DaySummary, AddBookModal, etc.
│   └── types.ts              # BookRow, LogRow types
├── n8n/chapter-daily-summary.json   # n8n workflow to import
├── scripts/                  # verify-phase1 / verify-9router / verify-telegram
├── ecosystem.config.cjs       # PM2 config (CommonJS — required because package.json has "type": "module")
├── deploy.sh                 # Deploy helper
├── .env.local.example        # Env template
└── package.json
```

---

## 🔧 Prerequisites (on `e7240ubt`)

- Node.js 20+ (with `npm`, `npx`)
- PostgreSQL running (existing `dwh` database; tables go in `chapter` schema)
- 9router reachable at `https://9router-ubt.mrl.asia/v1/chat/completions`
- n8n instance running
- Telegram bot token + your chat ID
- Book files at `/opt/chapter/workspace/books/`

---

## 🚀 Deployment

### 1. Clone / pull
```bash
cd /opt/chapter/workspace/chapter   # or your deploy dir
git pull origin dev
```

### 2. Install + build
```bash
npm install
npm run build        # builds frontend (dist/) + backend (dist/server.mjs)
```

### 3. Configure environment
```bash
cp .env.local.example .env.local
nano .env.local
```
Fill in (see `.env.local.example` for all keys):
```env
DATABASE_URL=postgresql://<user>:<pass>@localhost:5432/dwh
NINE_ROUTER_URL=https://9router-ubt.mrl.asia/v1/chat/completions
NINE_ROUTER_MODEL=n8n
NINE_ROUTER_API_KEY=***          # your 9router key
TELEGRAM_BOT_TOKEN=***       # from @BotFather
TELEGRAM_CHAT_ID=***          # your chat id (numeric, no -100 prefix for PM)
CHAPTER_BOOKS_DIR=/opt/chapter/workspace/books
PORT=3000
```
> Tables (`chapter.books`, `chapter.reading_log`) are created automatically on
> server boot (`ensureSchema`). No manual SQL needed.

### 4. Start with PM2
```bash
pm2 start ecosystem.config.cjs --env production
pm2 save
```
Or use the helper:
```bash
bash deploy.sh
```

### 5. Verify
```bash
curl localhost:3000/api/books          # should return [] (empty library)
curl -X POST localhost:3000/api/books/all/advance   # 200 (no active books yet)
```
Open `chapter.mrl.asia` in browser.

---

## 📅 n8n Workflow (Telegram Delivery)

1. In n8n → **Workflows → Import from File** → select
   `n8n/chapter-daily-summary.json`
2. The workflow:
   - **Schedule Trigger** at 07:00 daily
   - **HTTP Request** `POST /api/books/all/advance`
   - **HTTP Request** `GET /api/books/all/log/today`
   - **Code Node** formats one message per book (MarkdownV2)
   - **HTTP Request** `POST /api/books/all/notify` → pushes to Telegram + marks `telegram_sent`
3. **Test manually**: click "Execute Workflow" once. You should receive a Telegram
   message with today's summaries (after you've added + read at least one book).
4. Activate the workflow so it runs daily at 07:00.

> If `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` are missing, `/all/notify` returns
> `500 Telegram not configured` — set them in `.env.local` and restart PM2.

---

## 📚 Adding a Book

1. Place the file in `/opt/chapter/workspace/books/` (e.g. `atomic-habits.pdf`).
2. In the app → **Add Book** → fill Title, Author, **File path**
   (`/opt/chapter/workspace/books/atomic-habits.pdf`), Type (PDF/EPUB), Pages/day.
3. Tick **Auto from Open Library** to fetch a cover automatically (or paste a URL).
4. Click **Add Book**. The card appears in your Library.
5. Click **Read Today** (or **Read All Today**) to generate the first AI summary.

---

## 🔌 API Reference

### Books
| Method | Route | Description |
|---|---|---|
| GET | `/api/books` | List all books |
| POST | `/api/books` | Register a book |
| PATCH | `/api/books/:id` | Update (title, author, cover_url, daily_pages, status, total_pages) |
| DELETE | `/api/books/:id` | Remove book (keeps reading_log) |
| GET | `/api/books/:id/log` | Full reading history |

### Reading Engine
| Method | Route | Description |
|---|---|---|
| POST | `/api/books/:id/advance` | Extract next chunk → 9router → save summary |
| POST | `/api/books/all/advance` | Advance all `active` books (cron target) |
| POST | `/api/books/:id/retry/:date` | Re-generate summary for a day |
| GET | `/api/books/:id/log/today` | Today's entry for one book |
| GET | `/api/books/all/log/today` | Today's entries for all active books |
| POST | `/api/books/all/notify` | Push today's logs to Telegram + mark sent |

### Existing (base, keep)
- `GET/POST /api/community/posts` — Community feed
- `POST /api/gemini/suggest-books`, `POST /api/gemini/analyze-summary` — Gemini

---

## 🧪 Local Verification (Hermes / CI)

```bash
npm run verify:phase1     # pg-mem integration test (no DB needed)
npm run verify:9router    # live 9router call + parser test (needs NINE_ROUTER_API_KEY)
npm run verify:telegram   # MarkdownV2 escape + format unit test
npm run typecheck         # tsc --noEmit
```

---

## 🗃️ Data Model

**books** (chapter schema): `id` (UUID), `title`, `author`, `file_path`, `file_type`
(pdf/epub), `total_pages`, `daily_pages`, `current_page`, `status`
(active/paused/finished), `cover_url`, `created_at`.

**reading_log**: `id`, `book_id` (FK), `date`, `page_start`, `page_end`, `raw_text`,
`summary`, `key_insights` (text[]), `quote`, `telegram_sent` (bool), `created_at`.

---

## 🔧 Troubleshooting

| Symptom | Fix |
|---|---|
| `/all/notify` returns 500 | Set `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` in `.env.local`, restart PM2 |
| No Telegram message | Check bot is started (`/start` in chat), chat ID correct, n8n workflow active |
| PDF extraction empty | Verify file path exists on `e7240ubt`, file is text-based (not scanned) |
| `today` log mismatch | Server uses **local** date (Asia/Bangkok); ensure `TZ` is set correctly |
| Streak shows 0 | Streak counts consecutive days with a `reading_log` entry up to today |
| Cover broken image | Auto-fallback to placeholder on error; re-edit cover in Book Detail |

---

## 📌 Out of Scope

- TTS / audio output
- OCR for scanned PDFs
- Multi-user / auth
- Cloud file storage
- Community feed persistence (in-memory base demo)

---

## 📝 Development Notes

- **Streak** is computed client-side from `reading_log` dates (local timezone).
- **Idempotency**: `/advance` skips if today's entry already exists (safe to re-run).
- **Schema**: tables live in `chapter` schema inside the `dwh` database
  (`search_path=chapter` set on the pool).
- **Build output**: ESM (`dist/server.mjs`) — run with `node dist/server.mjs`.
