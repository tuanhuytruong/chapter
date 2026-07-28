import { newDb } from "pg-mem";
import express from "express";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { setPool } from "../src/db.ts";
import { podcastsRouter } from "../src/routes/podcasts.ts";

const db = newDb();
db.public.registerFunction({ name: "gen_random_uuid", implementation: () => crypto.randomUUID(), impure: true });
db.public.none(`
  CREATE TABLE users (id uuid primary key, username text, password_hash text, display_name text, podcast_voice_gender text);
  CREATE TABLE books (id uuid primary key, owner_id uuid not null references users(id), title text, author text, file_type text, summary_lang text, reading_round int default 1);
  CREATE TABLE reading_log (id uuid primary key, book_id uuid references books(id), page_start int, page_end int);
  CREATE TABLE podcasts (id uuid primary key, user_id uuid references users(id), book_id uuid references books(id), log_id uuid references reading_log(id), chapter_key text, chapter_title text, language text, voice_model text, status text, script_text text, word_count int, duration_s int, tg_file_id text, tg_file_unique_id text, tg_chat_id text, tg_message_id bigint, local_cache_path text, local_cache_until timestamptz, error_message text, created_at timestamptz default now(), updated_at timestamptz default now());
`);
const pool = new (db.adapters.createPg().Pool)();
setPool(pool as any);
const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const book = "10000000-0000-4000-8000-000000000001";
const log = "20000000-0000-4000-8000-000000000001";
const episode = "30000000-0000-4000-8000-000000000001";
const cache = await mkdtemp(path.join(tmpdir(), "chapter-podcast-"));
const audioPath = path.join(cache, "episode.mp3");
const audio = Buffer.from("0123456789podcast-audio");
await writeFile(audioPath, audio);
await pool.query("INSERT INTO users VALUES ($1,'owner','x','Owner', 'female'),($2,'other','x','Other', 'male')", [owner, other]);
await pool.query("INSERT INTO books VALUES ($1,$2,'Book','Author','epub','en',1)", [book, owner]);
await pool.query("INSERT INTO reading_log VALUES ($1,$2,1,3)", [log, book]);
await pool.query("INSERT INTO podcasts (id,user_id,book_id,log_id,chapter_key,chapter_title,language,voice_model,status,script_text,duration_s,local_cache_path,local_cache_until) VALUES ($1,$2,$3,$4,'0:chapter','Chapter One','en','edge-tts/en-US-JennyNeural','ready','Transcript',2,$5,now() + interval '1 hour')", [episode, owner, book, log, audioPath]);

const app = express();
app.use(express.json());
app.use((req: any, _res, next) => { const id = req.header("x-user") || owner; req.session = { user: { id, username: "test", displayName: "Test" } }; req.user = req.session.user; next(); });
app.use("/api/podcasts", podcastsRouter);
const server = app.listen(0);
await new Promise<void>((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${(server.address() as any).port}`;
const assert = (value: any, message: string) => { if (!value) throw new Error(message); console.log(`✅ ${message}`); };
try {
  const historyResponse = await fetch(`${base}/api/podcasts/books/${book}`);
  const history = await historyResponse.json() as any[];
  assert(historyResponse.status === 200 && history.length === 1 && history[0].log_id === log, `history exposes the related log but hides Telegram metadata: ${JSON.stringify(history)}`);
  assert(!("tg_file_id" in history[0]) && !("local_cache_path" in history[0]), "history keeps archive and cache identifiers private");
  const partial = await fetch(`${base}/api/podcasts/${episode}/audio`, { headers: { Range: "bytes=2-7" } });
  assert(partial.status === 206 && partial.headers.get("content-range") === `bytes 2-7/${audio.length}`, "audio proxy serves HTTP Range responses");
  assert(Buffer.compare(Buffer.from(await partial.arrayBuffer()), audio.subarray(2, 8)) === 0, "audio proxy returns exactly requested bytes");
  const foreign = await fetch(`${base}/api/podcasts/${episode}/audio`, { headers: { "x-user": other } });
  assert(foreign.status === 404, "audio proxy enforces owner-only playback");
  console.log("PODCAST_ROUTE_FIXTURES_OK");
} finally { server.close(); await rm(cache, { recursive: true, force: true }); await pool.end(); }
