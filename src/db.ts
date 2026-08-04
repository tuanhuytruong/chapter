import { Pool } from "pg";
import { config } from "./config.js";

// Keep Postgres DATE columns as plain 'YYYY-MM-DD' strings instead of JS Date
// objects. The default JS Date parsing shifts to UTC and, once JSON-serialized
// by Express, produces an ISO string with a time suffix that breaks client-side
// `new Date(...)` parsing ("Invalid Date"). Returning the raw string avoids that.
const pgTypes = (Pool as any).types;
if (pgTypes && typeof pgTypes.setTypeParser === "function") {
  pgTypes.setTypeParser(1082, (val: string) => val); // 1082 = DATE oid
}

let pool: Pool;

type DbTimeouts = { statementTimeoutMs: number; lockTimeoutMs: number };
const requestTimeouts: DbTimeouts = {
  statementTimeoutMs: config.dbRequestStatementTimeoutMs,
  lockTimeoutMs: config.dbRequestLockTimeoutMs,
};
const backgroundTimeouts: DbTimeouts = {
  statementTimeoutMs: config.dbBackgroundStatementTimeoutMs,
  lockTimeoutMs: config.dbBackgroundLockTimeoutMs,
};

function createDefaultPool(): Pool {
  const connectionString = process.env.DATABASE_URL ?? "";
  const base = connectionString
    ? { connectionString, max: 10, idleTimeoutMillis: 30000 }
    : {
        host: "localhost",
        port: 5432,
        database: "chapter",
        user: "postgres",
        password: "",
        max: 1,
      };
  // No connection-wide timeout: schema bootstrap/migrations must not inherit a
  // web-request budget. Regular and background operations opt in below.
  return new Pool({ ...base, options: "-c search_path=chapter" });
}

export function getPool(): Pool {
  if (!pool) pool = createDefaultPool();
  return pool;
}

/** Inject a pool (used by integration tests with pg-mem). */
export function setPool(p: Pool): void {
  pool = p;
}

function asSafeMs(value: number): string {
  return String(Math.max(1, Math.floor(value)));
}

async function applyLocalTimeouts(client: any, timeouts: DbTimeouts): Promise<void> {
  // set_config accepts bound values; SET LOCAL does not support placeholders.
  await client.query(
    "SELECT set_config('statement_timeout', $1, true), set_config('lock_timeout', $2, true)",
    [asSafeMs(timeouts.statementTimeoutMs), asSafeMs(timeouts.lockTimeoutMs)],
  );
}

function logDbOutcome(operation: "request" | "background", start: number, error?: any, text?: string): void {
  const elapsedMs = Date.now() - start;
  if (error) {
    const msg = String(error?.message || error).replace(/\s+/g, " ").slice(0, 160);
    const sql = text ? text.replace(/\s+/g, " ").slice(0, 140) : "-";
    console.error(
      `[db] ${operation} failed duration_ms=${elapsedMs} code=${error?.code || "unknown"} msg=${msg} query=${sql}`,
    );
  } else if (elapsedMs >= 1000) {
    console.info(`[db] ${operation} slow duration_ms=${elapsedMs}`);
  }
}

async function timedQuery<T>(
  operation: "request" | "background",
  timeouts: DbTimeouts,
  text: string,
  params?: any[],
): Promise<{ rows: T[]; rowCount: number | null }> {
  const client = await getPool().connect();
  const start = Date.now();
  try {
    await client.query("BEGIN");
    await applyLocalTimeouts(client, timeouts);
    const res = await client.query(text, params);
    await client.query("COMMIT");
    logDbOutcome(operation, start);
    return { rows: res.rows, rowCount: res.rowCount };
  } catch (error: any) {
    await client.query("ROLLBACK").catch(() => undefined);
    logDbOutcome(operation, start, error, text);
    throw error;
  } finally {
    client.release();
  }
}

/** Ordinary API query with a bounded DB statement and lock wait. */
export function query<T = any>(text: string, params?: any[]) {
  return timedQuery<T>("request", requestTimeouts, text, params);
}

/** Explicitly bounded larger allowance for background/batch work only. */
export function backgroundQuery<T = any>(text: string, params?: any[]) {
  return timedQuery<T>("background", backgroundTimeouts, text, params);
}

export async function withClient<T>(fn: (client: any) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

async function timedTransaction<T>(
  operation: "request" | "background",
  timeouts: DbTimeouts,
  fn: (client: any) => Promise<T>,
): Promise<T> {
  return withClient(async (client) => {
    const start = Date.now();
    await client.query("BEGIN");
    try {
      await applyLocalTimeouts(client, timeouts);
      const result = await fn(client);
      await client.query("COMMIT");
      logDbOutcome(operation, start);
      return result;
    } catch (error: any) {
      await client.query("ROLLBACK").catch(() => undefined);
      logDbOutcome(operation, start, error);
      throw error;
    }
  });
}

/** Run related API writes atomically under the ordinary request budget. */
export function withTransaction<T>(fn: (client: any) => Promise<T>): Promise<T> {
  return timedTransaction("request", requestTimeouts, fn);
}

/** Run known background/batch writes under a larger but still bounded budget. */
export function withBackgroundTransaction<T>(
  fn: (client: any) => Promise<T>,
): Promise<T> {
  return timedTransaction("background", backgroundTimeouts, fn);
}

export async function ensureSchema(): Promise<void> {
  const fs = await import("fs");
  const path = await import("path");
  const sql = fs.readFileSync(path.join(process.cwd(), "src/db/schema.sql"), "utf8");
  const stripped = sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\r\n]*/g, " ");
  const statements = stripped
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Bootstrap deliberately bypasses web timeout helpers; deploy/migration
  // execution is bounded by its supervisor rather than an API request SLA.
  const activePool = getPool();
  for (const stmt of statements) {
    try {
      await activePool.query(stmt);
    } catch (err: any) {
      const isSchemaPermErr =
        /create schema/i.test(stmt) && /permission denied/i.test(err.message);
      if (isSchemaPermErr) {
        console.warn("[db] skipping CREATE SCHEMA (permission denied) — assuming schema 'chapter' already exists");
        continue;
      }
      console.error("[db] schema statement failed:", err.message);
      console.error("[db] statement:", stmt.slice(0, 80));
      throw err;
    }
  }
  console.log("[db] schema ensured");
}

/** Core feature tables that must exist before the app serves authenticated APIs. */
export async function verifyCoreSchema(): Promise<void> {
  const required = [
    "books", "reading_log", "uploaded_files", "review_cards",
    "weekly_reading_goals", "story_thread_analyses", "story_state_snapshots",
    "onboarding_progress", "podcasts", "subscriptions", "usage_events",
    "membership_prompt_state", "monthly_reviews", "ask_reading_answers",
    "cross_book_connections", "podcast_recaps", "billing_orders",
    "billing_confirmations", "billing_transactions", "reading_lens_synthesis",
    "auth_rate_limits",
  ];
  const { rows } = await query<{ relation: string | null }>(
    "SELECT to_regclass('chapter.' || unnest($1::text[])) AS relation",
    [required],
  );
  const missing = required.filter((_, index) => !rows[index]?.relation);
  if (missing.length) {
    throw new Error(`required schema relations missing: ${missing.map((name) => `chapter.${name}`).join(", ")}`);
  }
  console.log("[db] core schema verified");
}
