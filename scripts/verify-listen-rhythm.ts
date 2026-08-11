// Listening rhythm — twin-track verification (pg-mem + express + x-user).
// Proves: (1) PUT progress only records a listen event once an episode counts
// as listened (completed, or >=60s heard); (2) the upsert keeps max seconds and
// ORs completion; (3) getListenRhythm returns day sets + per-book completion.
import { newDb } from "pg-mem";
import express from "express";
import assert from "node:assert";
import { setPool } from "../src/db.ts";
import { podcastsRouter } from "../src/routes/podcasts.ts";
import { buildListenRhythm, getListenRhythm, listenDateKey } from "../src/listenRhythm.ts";

const db = newDb();
db.public.registerFunction({ name: "gen_random_uuid", implementation: () => crypto.randomUUID(), impure: true });
db.public.none(`
  CREATE TABLE users (id uuid primary key, username text, display_name text, podcast_voice_gender text);
  CREATE TABLE books (id uuid primary key, owner_id uuid not null references users(id), title text, author text, cover_url text, file_type text, summary_lang text, reading_round int default 1, file_path text, created_at timestamptz default now(), total_pages int);
  CREATE TABLE reading_log (id uuid primary key, book_id uuid references books(id), date date, page_start int, page_end int);
  CREATE TABLE podcasts (id uuid primary key default gen_random_uuid(), user_id uuid references users(id), book_id uuid references books(id), log_id uuid, reading_round int, chapter_key text, chapter_title text, language text, voice_model text, status text, script_text text, word_count int, duration_s int, tg_file_id text, tg_file_unique_id text, tg_chat_id text, tg_message_id bigint, local_cache_path text, local_cache_until timestamptz, error_message text, created_at timestamptz default now(), updated_at timestamptz default now());
  CREATE TABLE podcast_narrators (book_id uuid not null references books(id), reading_round int not null check (reading_round >= 1), voice_gender text not null check (voice_gender in ('female','male')), created_at timestamptz default now(), PRIMARY KEY(book_id, reading_round));
  CREATE TABLE podcast_playback_progress (user_id uuid not null references users(id), book_id uuid not null references books(id), reading_round int not null check (reading_round >= 1), podcast_id uuid not null references podcasts(id), current_time_seconds double precision not null default 0, completed_at timestamptz null, updated_at timestamptz not null default now(), PRIMARY KEY(user_id, book_id, reading_round));
  CREATE TABLE podcast_listen_events (id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id), book_id uuid not null references books(id), podcast_id uuid references podcasts(id), chapter_key text not null, reading_round int not null default 1 check (reading_round >= 1), listened_on date not null, seconds_heard real not null default 0 check (seconds_heard >= 0), completed boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), UNIQUE(user_id, podcast_id, listened_on));
`);
const pool = new (db.adapters.createPg().Pool)();
setPool(pool as any);

const owner = "00000000-0000-4000-8000-000000000001";
const book = "10000000-0000-4000-8000-000000000001";
const epOne = "30000000-0000-4000-8000-000000000001";
const epTwo = "30000000-0000-4000-8000-000000000002";

await pool.query("INSERT INTO users VALUES ($1,'owner','Owner','female')", [owner]);
await pool.query("INSERT INTO books (id,owner_id,title,author,file_type,summary_lang,reading_round,file_path) VALUES ($1,$2,'Book','Author','epub','en',1,'/no-file.epub')", [book, owner]);
await pool.query(
  "INSERT INTO reading_log (id,book_id,date) VALUES ($1,$2,'2026-08-04'),($3,$2,'2026-08-05')",
  ["40000000-0000-4000-8000-000000000001", book, "40000000-0000-4000-8000-000000000002"],
);
await pool.query(
  `INSERT INTO podcasts (id,user_id,book_id,reading_round,chapter_key,chapter_title,status,script_text,duration_s)
   VALUES ($1,$2,$3,1,'0:chapter-one','Chapter One','ready','T',120),($4,$2,$3,1,'1:chapter-two','Chapter Two','ready','T',180)`,
  [epOne, owner, book, epTwo],
);
await pool.query("INSERT INTO podcast_narrators (book_id,reading_round,voice_gender) VALUES ($1,1,'female')", [book]);

const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  const id = req.header("x-user") || owner;
  req.session = { user: { id, username: "test", displayName: "Test" } };
  req.user = req.session.user;
  next();
});
app.use("/api/podcasts", podcastsRouter);
const server = app.listen(0);
await new Promise<void>((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${(server.address() as any).port}`;

const put = (episodeId: string, seconds: number, completed: boolean) =>
  fetch(`${base}/api/podcasts/books/${book}/playlist/progress`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ podcast_id: episodeId, current_time_seconds: seconds, completed }),
  });

const countEvents = async (): Promise<number> =>
  (await pool.query("SELECT count(*)::int AS n FROM podcast_listen_events")).rows[0].n;

// Bangkok midnight can have the previous UTC calendar date; preserve Bangkok's day key.
const bangkokMidnight = new Date("2026-08-10T17:00:00.000Z");
assert.equal(bangkokMidnight.toISOString().slice(0, 10), "2026-08-10");
assert.equal(listenDateKey(bangkokMidnight), "2026-08-11", "listening keys use the Chapter calendar, not UTC");
assert.equal(listenDateKey("2026-08-11"), "2026-08-11", "plain SQL date strings remain stable");
assert.equal(listenDateKey(new Date("2026-08-11T00:00:00.000Z")), "2026-08-11", "Bangkok SQL-date driver values retain their stored calendar key");

// 1. 30s, not completed → no listen event yet
let res = await put(epOne, 30, false);
assert.equal(res.status, 200, "progress PUT must succeed");
assert.equal(await countEvents(), 0, "under 60s must not record a listen event");

// 2. 90s → event recorded (>=60s counts as listened)
res = await put(epOne, 90, false);
assert.equal(res.status, 200);
assert.equal(await countEvents(), 1, ">=60s must record a listen event");

// 3. repeat with fewer seconds → seconds_heard keeps the max (GREATEST)
await put(epOne, 45, false);
const ev = (await pool.query("SELECT seconds_heard AS s FROM podcast_listen_events WHERE podcast_id=$1", [epOne])).rows[0];
assert.equal(Number(ev.s), 90, "GREATEST must keep max seconds_heard");

// 4. completed on another episode → second event with completed=true
await put(epTwo, 10, true);
assert.equal(await countEvents(), 2, "completed episode must record a listen event");
const evTwo = (await pool.query("SELECT completed FROM podcast_listen_events WHERE podcast_id=$1", [epTwo])).rows[0];
assert.equal(evTwo.completed, true, "completed flag must persist");

// 5. aggregation endpoint logic
const rhythm = await getListenRhythm(owner);
assert.ok(
  rhythm.reading_days.includes("2026-08-04") && rhythm.reading_days.includes("2026-08-05"),
  "reading_days must come from reading_log",
);
assert.equal(rhythm.listening_days.length, 1, "both episodes on the same day → one listening day");
assert.equal(rhythm.listening_episodes_total, 2, "2 distinct episodes heard");
assert.equal(rhythm.books.length, 1, "only the book with podcasts is listed");
assert.equal(rhythm.books[0].episodes_total, 2, "2 ready episodes");
assert.equal(rhythm.books[0].episodes_listened, 2, "both episodes heard");
assert.ok(rhythm.total_listen_seconds >= 100, "total seconds = 90 + 10");

// 6. pure builder: ready episodes with nothing listened stay listed at 0;
//    no podcasts at all → empty books array.
const pure = buildListenRhythm({
  readingDays: ["2026-08-05"],
  listeningDays: [],
  episodeTotals: [{ book_id: book, reading_round: 1, episodes_total: 2 }],
  listened: [],
  titles: [{ id: book, title: "Book" }],
  totalListenSeconds: 0,
  listenByDay: [],
});
assert.equal(pure.books.length, 1);
assert.equal(pure.books[0].episodes_listened, 0);
assert.equal(pure.listen_by_day.length, 0);
const empty = buildListenRhythm({ readingDays: [], listeningDays: [], episodeTotals: [], listened: [], titles: [], totalListenSeconds: 0, listenByDay: [] });
assert.equal(empty.books.length, 0);
assert.equal(empty.listening_episodes_total, 0);

server.close();
console.log("✅ verify-listen-rhythm: all assertions passed");
