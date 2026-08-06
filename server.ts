import express, { Request, Response } from "express";
import compression from "compression";
import session from "express-session";
import pgSession from "connect-pg-simple";
import bcrypt from "bcrypt";
import { OAuth2Client } from "google-auth-library";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { booksRouter } from "./src/routes/books.js";
import { reviewsRouter } from "./src/routes/reviews.js";
import { uploadRouter } from "./src/routes/upload.js";
import {
  podcastsRouter,
  startPodcastMaintenance,
} from "./src/routes/podcasts.js";
import { entitlementsRouter } from "./src/routes/entitlements.js";
import { billingRouter } from "./src/routes/billing.js";
import { monthlyReviewsRouter } from "./src/routes/monthly-review.js";
import { askReadingRouter } from "./src/routes/ask-reading.js";
import { crossBookConnectionsRouter } from "./src/routes/cross-book-connections.js";
import { podcastRecapRouter } from "./src/routes/podcast-recap.js";
import { ensureSchema, query, verifyCoreSchema } from "./src/db.js";
import { callLLM } from "./src/llm.js";
import { avatarFor, requireAuth, userFrom } from "./src/auth.js";
import { getPool } from "./src/db.js";
import {
  dateInAppTz,
  progressFor,
  type WeeklyGoalMetric,
  type WeeklyGoalRow,
} from "./src/weekly-goal.js";
import { achievementResponse } from "./src/achievements.js";
import { getListenRhythm } from "./src/listenRhythm.js";
import { config } from "./src/config.js";
import {
  createLinkToken,
  deepLink,
  linkExpiresAt,
  telegramUpdate,
} from "./src/telegram-link.js";
import { isAvatarPresetValue } from "./src/avatar-presets.js";
import {
  newOpaqueToken,
  normalizeEmail,
  passwordError,
  pkceChallenge,
  randomUrlToken,
  safeUsername,
  sha256,
  tokenHash,
} from "./src/auth-identity.js";
import { sendPasswordResetEmail } from "./src/email.js";
import { authRateLimit, authRateLimitPolicies } from "./src/auth-rate-limit.js";

// Each release folder owns its listener through .env.local (3000 PRD / 3001 DEV).
const PORT = config.port;

const app = express();
const APP_ENV = config.appEnv;
const sessionSecret =
  process.env.SESSION_SECRET ||
  (APP_ENV === "dev" ? "development-only-session-secret" : "");
if (!sessionSecret)
  throw new Error("SESSION_SECRET is required when APP_ENV=prd");
// Production deployments terminate TLS at the reverse proxy. Trust that single
// proxy so express-session can issue its secure cookie from X-Forwarded-Proto.
app.set("trust proxy", 1);
app.use(compression());
app.use((req, res, next) => {
  // API/session responses are sensitive; static and SPA handlers override this
  // later with their own policy.
  if (req.path.startsWith("/api/")) res.setHeader("Cache-Control", "no-store");
  next();
});
app.use(express.json());
// Public liveness probe: intentionally does not require a session or database query.
app.get("/health", (_req, res) => res.status(200).json({ ok: true }));
const PgStore = pgSession(session);
app.use(
  session({
    store: process.env.DATABASE_URL
      ? new PgStore({
          pool: getPool(),
          schemaName: "chapter",
          tableName: "session",
        })
      : undefined,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  }),
);

// Telegram webhook stays public because Telegram cannot hold a Chapter session. The
// provider secret and one-time token bind the incoming chat to exactly one user.
app.post("/api/telegram/webhook", async (req: Request, res: Response) => {
  if (
    !config.telegramWebhookSecret ||
    req.header("x-telegram-bot-api-secret-token") !==
      config.telegramWebhookSecret
  ) {
    return res.status(401).json({ ok: false });
  }
  const incoming = telegramUpdate(req.body);
  if (!incoming) return res.status(200).json({ ok: true });
  try {
    const { rowCount } = await query(
      `UPDATE users SET telegram_chat_id=$1, telegram_link_token=NULL, telegram_link_expires_at=NULL
       WHERE telegram_link_token=$2 AND telegram_link_expires_at > now()`,
      [incoming.chatId, incoming.token],
    );
    res.status(200).json({ ok: true, linked: rowCount === 1 });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: "Telegram linking unavailable" });
  }
});

async function establishSession(
  req: Request,
  row: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string | null;
  },
) {
  await new Promise<void>((resolve, reject) =>
    req.session.regenerate((error) => (error ? reject(error) : resolve())),
  );
  req.session.user = {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url || avatarFor(row.username),
  };
  await new Promise<void>((resolve, reject) =>
    req.session.save((error) => (error ? reject(error) : resolve())),
  );
  return req.session.user;
}

function authConfigured() {
  return Boolean(config.googleClientId && config.googleClientSecret);
}
function googleRedirectUri() {
  return `${config.appUrl.replace(/\/$/, "")}/api/auth/google/callback`;
}
const genericRecoveryResponse = {
  ok: true,
  message: "If an account matches this email, we’ve sent a reset link.",
};

app.get("/api/auth/session", (req, res) =>
  res.json({ user: req.session.user || null }),
);
app.get("/api/auth/me", (req, res) =>
  res.json({ user: req.session.user || null }),
);
app.post("/api/auth/login", authRateLimit(
    authRateLimitPolicies.login(
      config.authRateLimitWindowMs,
      config.authLoginMaxAttempts,
    ),
  ),
  async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== "string" || typeof password !== "string")
    return res.status(400).json({ error: "username and password required" });
  try {
    const { rows } = await query<any>(
      "SELECT id, username, display_name, avatar_url, password_hash FROM users WHERE username=$1 AND environment=$2",
      [username.trim(), APP_ENV],
    );
    const row = rows[0];
    if (
      !row?.password_hash ||
      !(await bcrypt.compare(password, row.password_hash))
    )
      return res.status(401).json({ error: "Invalid username or password" });
    res.json({ user: await establishSession(req, row) });
  } catch {
    res.status(503).json({ error: "Authentication service unavailable" });
  }
  },
);

app.post("/api/auth/forgot-password", authRateLimit(
    authRateLimitPolicies.forgotPassword(
      config.authRateLimitWindowMs,
      config.authPasswordResetMaxAttempts,
    ),
  ),
  async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(202).json(genericRecoveryResponse);
  try {
    const { rows } = await query<any>(
      "SELECT id, email FROM users WHERE lower(email)=lower($1) AND email_verified_at IS NOT NULL AND environment=$2",
      [email, APP_ENV],
    );
    const user = rows[0];
    if (user) {
      const rawToken = newOpaqueToken();
      await query(
        "UPDATE password_reset_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL",
        [user.id],
      );
      await query(
        "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, requested_ip_hash) VALUES ($1, $2, now() + ($3 || ' minutes')::interval, $4)",
        [
          user.id,
          tokenHash(rawToken),
          String(config.passwordResetTtlMinutes),
          sha256(req.ip || ""),
        ],
      );
      try {
        await sendPasswordResetEmail({
          to: user.email,
          resetUrl: `${config.appUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(rawToken)}`,
        });
      } catch {
        await query(
          "UPDATE password_reset_tokens SET used_at=now() WHERE token_hash=$1",
          [tokenHash(rawToken)],
        );
        console.error("[auth] password reset email delivery failed");
      }
    }
  } catch {
    console.error("[auth] password reset request unavailable");
  }
  res.status(202).json(genericRecoveryResponse);
  },
);

app.post(
  "/api/auth/reset-password",
  authRateLimit(
    authRateLimitPolicies.resetPassword(
      config.authRateLimitWindowMs,
      config.authPasswordResetMaxAttempts,
    ),
  ),
  async (req, res) => {
  const { token, newPassword, confirmPassword } = req.body || {};
  if (
    typeof token !== "string" ||
    !token ||
    passwordError(newPassword) ||
    newPassword !== confirmPassword
  )
    return res
      .status(400)
      .json({
        error: "Use a matching password between 10 and 256 characters.",
      });
  try {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const { rows } = await query<any>(
      `WITH consumed AS (
      UPDATE password_reset_tokens SET used_at=now()
      WHERE token_hash=$1 AND used_at IS NULL AND expires_at > now()
      RETURNING user_id
    ), updated AS (
      UPDATE users SET password_hash=$2, password_changed_at=now()
      WHERE id=(SELECT user_id FROM consumed)
      RETURNING id, username, display_name, avatar_url
    ), revoked AS (
      DELETE FROM chapter.session WHERE sess->'user'->>'id'=(SELECT id::text FROM updated)
    ) SELECT * FROM updated`,
      [tokenHash(token), passwordHash],
    );
    const user = rows[0];
    if (!user)
      return res
        .status(400)
        .json({ error: "This reset link is invalid or has expired." });
    res.json({ user: await establishSession(req, user) });
  } catch {
    res
      .status(503)
      .json({ error: "Password reset is unavailable. Please try again." });
  }
  },
);

app.get(
  "/api/auth/google",
  authRateLimit(
    authRateLimitPolicies.oauth(
      config.authRateLimitWindowMs,
      config.authOauthMaxAttempts,
    ),
  ),
  (req, res) => {
  const intent = req.query.intent === "link" ? "link" : "login";
  if (!authConfigured() || (intent === "link" && !req.session.user))
    return res.redirect(`${config.appUrl}/login?auth_error=google`);
  const state = randomUrlToken(),
    nonce = randomUrlToken(),
    verifier = randomUrlToken();
  req.session.googleAuth = {
    state,
    nonce,
    verifier,
    intent,
    userId: intent === "link" ? req.session.user!.id : undefined,
    expiresAt: Date.now() + 10 * 60_000,
  };
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  res.redirect(url.toString());
  },
);

app.get("/api/auth/google/callback", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const pending = req.session.googleAuth;
  delete req.session.googleAuth;
  if (
    !pending ||
    pending.expiresAt < Date.now() ||
    req.query.state !== pending.state ||
    typeof req.query.code !== "string" ||
    !authConfigured()
  )
    return res.redirect(`${config.appUrl}/login?auth_error=google`);
  try {
    const client = new OAuth2Client(
      config.googleClientId,
      config.googleClientSecret,
      googleRedirectUri(),
    );
    const { tokens } = await client.getToken({
      code: req.query.code,
      codeVerifier: pending.verifier,
      redirect_uri: googleRedirectUri(),
    });
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token || "",
      audience: config.googleClientId,
    });
    const payload = ticket.getPayload();
    const email = normalizeEmail(payload?.email);
    if (
      !payload?.sub ||
      !email ||
      !payload.email_verified ||
      payload.nonce !== pending.nonce
    )
      throw new Error("invalid Google identity");
    let row: any;
    if (pending.intent === "link") {
      const { rows } = await query<any>(
        "SELECT id, username, display_name, avatar_url FROM users WHERE id=$1",
        [pending.userId],
      );
      row = rows[0];
      if (!row) throw new Error("link account missing");
      const conflict = (
        await query<any>(
          "SELECT id FROM users WHERE google_sub=$1 AND id<>$2",
          [payload.sub, row.id],
        )
      ).rows[0];
      if (conflict) throw new Error("link conflict");
      await query(
        "UPDATE users SET google_sub=$1, email=COALESCE(email,$2), email_verified_at=COALESCE(email_verified_at,now()) WHERE id=$3",
        [payload.sub, email, row.id],
      );
    } else {
      row =
        (
          await query<any>(
            "SELECT id, username, display_name, avatar_url FROM users WHERE google_sub=$1 AND environment=$2",
            [payload.sub, APP_ENV],
          )
        ).rows[0] ||
        (
          await query<any>(
            "SELECT id, username, display_name, avatar_url FROM users WHERE lower(email)=lower($1) AND environment=$2",
            [email, APP_ENV],
          )
        ).rows[0];
      if (row)
        await query(
          "UPDATE users SET google_sub=$1, email=$2, email_verified_at=now() WHERE id=$3",
          [payload.sub, email, row.id],
        );
      else
        row = (
          await query<any>(
            "INSERT INTO users (username, environment, password_hash, email, google_sub, email_verified_at, display_name, avatar_url) VALUES ($1,$2,NULL,$3,$4,now(),$5,$6) RETURNING id, username, display_name, avatar_url",
            [
              safeUsername(email),
              APP_ENV,
              email,
              payload.sub,
              payload.name?.slice(0, 60) || email.split("@")[0],
              payload.picture || null,
            ],
          )
        ).rows[0];
    }
    await establishSession(req, row);
    res.redirect(`${config.appUrl}/`);
  } catch {
    res.redirect(`${config.appUrl}/login?auth_error=google`);
  }
});

app.post("/api/auth/logout", (req, res) =>
  req.session.destroy(() => res.status(204).end()),
);
app.use("/api", requireAuth);
app.get("/api/auth/profile", async (req: Request, res: Response) => {
  try {
    const { rows } = await query<{
      username: string;
      display_name: string;
      avatar_url: string | null;
      podcast_voice_gender: "female" | "male" | null;
      email: string | null;
      google_sub: string | null;
      password_hash: string | null;
    }>(
      "SELECT username, display_name, avatar_url, podcast_voice_gender, email, google_sub, password_hash FROM users WHERE id=$1",
      [userFrom(req).id],
    );
    const profile = rows[0];
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    res.json({
      username: profile.username,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url || null,
      podcastVoiceGender: profile.podcast_voice_gender || null,
      email: profile.email,
      googleConnected: Boolean(profile.google_sub),
      hasPassword: Boolean(profile.password_hash),
    });
  } catch {
    res.status(500).json({ error: "Could not load profile" });
  }
});
app.patch("/api/auth/profile", async (req: Request, res: Response) => {
  const displayName =
    typeof req.body?.displayName === "string"
      ? req.body.displayName.trim()
      : "";
  const avatarUrl = req.body?.avatarUrl;
  if (!displayName || displayName.length > 60)
    return res
      .status(400)
      .json({ error: "displayName must be between 1 and 60 characters" });
  if (!isAvatarPresetValue(avatarUrl))
    return res.status(400).json({ error: "Choose an available avatar" });
  try {
    const { rows } = await query<{
      username: string;
      display_name: string;
      avatar_url: string;
    }>(
      "UPDATE users SET display_name=$1, avatar_url=$2 WHERE id=$3 RETURNING username, display_name, avatar_url",
      [displayName, avatarUrl, userFrom(req).id],
    );
    const updated = rows[0];
    req.session.user = {
      ...userFrom(req),
      username: updated.username,
      displayName: updated.display_name,
      avatarUrl: updated.avatar_url,
    };
    res.json({ user: req.session.user });
  } catch {
    res.status(500).json({ error: "Could not save profile" });
  }
});
app.post("/api/auth/change-password", async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body || {};
  if (
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string" ||
    newPassword.length < 8
  ) {
    return res
      .status(400)
      .json({
        error:
          "currentPassword and a newPassword of at least 8 characters are required",
      });
  }
  try {
    const user = (
      await query("SELECT password_hash FROM users WHERE id=$1", [
        userFrom(req).id,
      ])
    ).rows[0];
    if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }
    await query("UPDATE users SET password_hash=$1 WHERE id=$2", [
      await bcrypt.hash(newPassword, 12),
      userFrom(req).id,
    ]);
    res.json({ ok: true });
  } catch (e: any) {
    res
      .status(500)
      .json({ error: "Failed to change password", detail: e.message });
  }
});
app.get("/api/auth/telegram", async (req: Request, res: Response) => {
  try {
    const { rows } = await query(
      "SELECT telegram_chat_id FROM users WHERE id=$1",
      [userFrom(req).id],
    );
    res.json({ connected: Boolean(rows[0]?.telegram_chat_id) });
  } catch {
    res.status(500).json({ error: "Telegram status unavailable" });
  }
});
app.post("/api/auth/telegram/link", async (req: Request, res: Response) => {
  if (!config.telegramBotUsername)
    return res
      .status(503)
      .json({ error: "Telegram linking is not configured" });
  const token = createLinkToken();
  try {
    await query(
      "UPDATE users SET telegram_link_token=$1, telegram_link_expires_at=$2 WHERE id=$3",
      [token, linkExpiresAt(), userFrom(req).id],
    );
    res.json({
      url: deepLink(config.telegramBotUsername, token),
      expires_in_seconds: 900,
    });
  } catch {
    res.status(500).json({ error: "Could not start Telegram link" });
  }
});
app.delete("/api/auth/telegram", async (req: Request, res: Response) => {
  try {
    await query(
      "UPDATE users SET telegram_chat_id=NULL, telegram_link_token=NULL, telegram_link_expires_at=NULL WHERE id=$1",
      [userFrom(req).id],
    );
    res.json({ connected: false });
  } catch {
    res.status(500).json({ error: "Could not disconnect Telegram" });
  }
});

const ONBOARDING_STEPS = new Set([
  "welcome",
  "add_book",
  "first_session",
  "review",
  "journey",
  "story_thread",
]);
app.get("/api/onboarding", async (req: Request, res: Response) => {
  try {
    const { rows } = await query<{ dismissed_steps: string[] }>(
      "SELECT dismissed_steps FROM onboarding_progress WHERE owner_id=$1",
      [userFrom(req).id],
    );
    res.json({ dismissed_steps: rows[0]?.dismissed_steps || [] });
  } catch {
    res.status(500).json({ error: "Onboarding state unavailable" });
  }
});
app.patch("/api/onboarding", async (req: Request, res: Response) => {
  const steps = Array.isArray(req.body?.dismissed_steps)
    ? req.body.dismissed_steps.filter(
        (step: unknown): step is string =>
          typeof step === "string" && ONBOARDING_STEPS.has(step),
      )
    : null;
  if (!steps)
    return res
      .status(400)
      .json({ error: "dismissed_steps must be a valid step list" });
  try {
    const { rows } = await query<{ dismissed_steps: string[] }>(
      `INSERT INTO onboarding_progress (owner_id, dismissed_steps) VALUES ($1, $2)
       ON CONFLICT (owner_id) DO UPDATE SET dismissed_steps=EXCLUDED.dismissed_steps, updated_at=now()
       RETURNING dismissed_steps`,
      [userFrom(req).id, [...new Set(steps)]],
    );
    res.json({ dismissed_steps: rows[0].dismissed_steps });
  } catch {
    res.status(500).json({ error: "Could not save onboarding state" });
  }
});
app.use("/api/books", booksRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/podcasts", podcastsRouter);
app.use("/api/entitlements", entitlementsRouter);
app.use("/api/billing", billingRouter);
app.use("/api/monthly-review", monthlyReviewsRouter);
app.use("/api/ask-reading", askReadingRouter);
app.use("/api/cross-book-connections", crossBookConnectionsRouter);
app.use("/api/podcast-recap", podcastRecapRouter);

// ── Personal achievements (derived; no duplicate achievement state) ─
app.get("/api/achievements", async (req: Request, res: Response) => {
  try {
    const ownerId = userFrom(req).id;
    const [books, logs, insights, reflections, reviews] = await Promise.all([
      query<{ books_added: string; books_finished: string }>(
        "SELECT COUNT(*) AS books_added, COUNT(*) FILTER (WHERE status='finished') AS books_finished FROM books WHERE owner_id=$1",
        [ownerId],
      ),
      query<{ date: string; units_read: string }>(
        `SELECT rl.date::text AS date, COALESCE(SUM(rl.page_end - rl.page_start + 1), 0) AS units_read
         FROM reading_log rl JOIN books b ON b.id=rl.book_id WHERE b.owner_id=$1 GROUP BY rl.date`,
        [ownerId],
      ),
      query<{ insights_saved: string }>(
        `SELECT COALESCE(SUM(cardinality(rl.key_insights)), 0) AS insights_saved
         FROM reading_log rl JOIN books b ON b.id=rl.book_id WHERE b.owner_id=$1`,
        [ownerId],
      ),
      query<{ reflections_created: string }>(
        "SELECT COUNT(*) AS reflections_created FROM books WHERE owner_id=$1 AND reflection_text IS NOT NULL AND btrim(reflection_text) <> ''",
        [ownerId],
      ),
      query<{ reviews_completed: string }>(
        `SELECT COUNT(*) AS reviews_completed FROM review_cards rc JOIN books b ON b.id=rc.book_id
         WHERE b.owner_id=$1 AND rc.last_reviewed_at IS NOT NULL`,
        [ownerId],
      ),
    ]);
    const bookFacts = books.rows[0] || {
      books_added: "0",
      books_finished: "0",
    };
    res.json(
      achievementResponse({
        books_added: Number(bookFacts.books_added),
        books_finished: Number(bookFacts.books_finished),
        units_read: logs.rows.reduce(
          (total, row) => total + Number(row.units_read || 0),
          0,
        ),
        reading_days: logs.rows.map((row) => row.date),
        insights_saved: Number(insights.rows[0]?.insights_saved || 0),
        reflections_created: Number(
          reflections.rows[0]?.reflections_created || 0,
        ),
        reviews_completed: Number(reviews.rows[0]?.reviews_completed || 0),
      }),
    );
  } catch (e: any) {
    res
      .status(503)
      .json({ error: "achievements unavailable", detail: e.message });
  }
});

// ── Listening rhythm (twin-track: read + listen at the day level) ─────────
// Returns raw day sets + book-level audio completion; the client derives
// read/listen/active streaks with computeStreak() (existing convention).
app.get("/api/rhythm", async (req: Request, res: Response) => {
  try {
    const bookId =
      typeof req.query.book_id === "string" && req.query.book_id
        ? req.query.book_id
        : undefined;
    const roundRaw =
      typeof req.query.round === "string" ? Number(req.query.round) : undefined;
    const round =
      roundRaw && Number.isInteger(roundRaw) && roundRaw > 0 ? roundRaw : undefined;
    const rhythm = await getListenRhythm(userFrom(req).id, { bookId, round });
    if (!rhythm) return res.status(404).json({ error: "book not found" });
    res.json(rhythm);
  } catch (e: any) {
    res.status(503).json({ error: "rhythm unavailable", detail: e.message });
  }
});

// ── Saved lines ───────────────────────────────────────────
app.get("/api/quotes", async (req: Request, res: Response) => {
  const requestedLimit = Number.parseInt(String(req.query.limit || "12"), 10);
  const requestedOffset = Number.parseInt(String(req.query.offset || "0"), 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(24, Math.max(1, requestedLimit))
    : 12;
  const offset = Number.isFinite(requestedOffset)
    ? Math.max(0, requestedOffset)
    : 0;
  const q =
    typeof req.query.q === "string" ? req.query.q.trim().slice(0, 120) : "";
  const bookId =
    typeof req.query.bookId === "string" ? req.query.bookId.trim() : "";
  const sort =
    req.query.sort === "oldest" || req.query.sort === "mixed"
      ? req.query.sort
      : "newest";
  const ownerId = userFrom(req).id;
  const params: unknown[] = [ownerId];
  const filters = [
    "b.owner_id=$1",
    "rl.quote IS NOT NULL",
    "btrim(rl.quote) <> ''",
  ];

  if (bookId) {
    params.push(bookId);
    filters.push(`rl.book_id=$${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    filters.push(
      `(rl.quote ILIKE $${params.length} OR b.title ILIKE $${params.length} OR b.author ILIKE $${params.length})`,
    );
  }

  const where = filters.join(" AND ");
  const orderBy =
    sort === "oldest"
      ? "rl.date ASC, rl.created_at ASC"
      : sort === "mixed"
        ? "md5(rl.book_id::text || rl.date::text || rl.quote), rl.date DESC"
        : "rl.date DESC, rl.created_at DESC";

  try {
    const pageParams = [...params, limit, offset];
    const [itemsResult, totalResult, booksResult] = await Promise.all([
      query(
        `SELECT rl.quote, rl.date, rl.book_id, b.title, b.author
             FROM chapter.reading_log rl
             JOIN chapter.books b ON b.id = rl.book_id
             WHERE ${where}
             ORDER BY ${orderBy}
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        pageParams,
      ),
      query(
        `SELECT COUNT(*)::int AS total
             FROM chapter.reading_log rl
             JOIN chapter.books b ON b.id = rl.book_id
             WHERE ${where}`,
        params,
      ),
      query(
        `SELECT DISTINCT b.id, b.title, b.author
             FROM chapter.reading_log rl
             JOIN chapter.books b ON b.id = rl.book_id
             WHERE b.owner_id=$1 AND rl.quote IS NOT NULL AND btrim(rl.quote) <> ''
             ORDER BY b.title ASC`,
        [ownerId],
      ),
    ]);
    res.json({
      items: itemsResult.rows,
      total: totalResult.rows[0]?.total || 0,
      books: booksResult.rows,
    });
  } catch (e: any) {
    res
      .status(500)
      .json({ error: "Failed to fetch quotes", detail: e.message });
  }
});

// ── Personal reading insights ─────────────────────────────
async function statsFor(ownerId: string | null) {
  // Ownership lives on books, not reading_log. Join through the parent book for
  // every log-derived metric so personal Insights never query a nonexistent
  // reading_log.owner_id column.
  const bookFilter = ownerId ? "AND b.owner_id=$1" : "";
  const params = ownerId ? [ownerId] : [];
  const [velocity, insights, bookCounts, globalStats] = await Promise.all([
    query(
      `SELECT (rl.date AT TIME ZONE 'Asia/Bangkok')::date AS date, SUM(rl.page_end-rl.page_start+1) AS pages_read
           FROM chapter.reading_log rl JOIN chapter.books b ON b.id=rl.book_id
           WHERE (rl.date AT TIME ZONE 'Asia/Bangkok')::date >= (NOW() AT TIME ZONE 'Asia/Bangkok')::date - INTERVAL '30 days' ${bookFilter}
           GROUP BY 1 ORDER BY 1`,
      params,
    ),
    query(
      `SELECT unnest(rl.key_insights) AS insight, COUNT(*) AS freq
           FROM chapter.reading_log rl JOIN chapter.books b ON b.id=rl.book_id
           WHERE true ${bookFilter} GROUP BY insight ORDER BY freq DESC LIMIT 50`,
      params,
    ),
    query(
      `SELECT COUNT(*) FILTER (WHERE status='active') AS active, COUNT(*) FILTER (WHERE status='finished') AS finished, COUNT(*) FILTER (WHERE status='paused') AS paused, COUNT(*) FILTER (WHERE status='queued') AS queued FROM chapter.books b WHERE true ${bookFilter}`,
      params,
    ),
    query(
      `SELECT COUNT(DISTINCT (rl.date AT TIME ZONE 'Asia/Bangkok')::date) AS total_days_read, MAX(rl.date AT TIME ZONE 'Asia/Bangkok') AS last_read
           FROM chapter.reading_log rl JOIN chapter.books b ON b.id=rl.book_id
           WHERE true ${bookFilter}`,
      params,
    ),
  ]);
  return {
    velocity: velocity.rows,
    insights: insights.rows,
    bookCounts: bookCounts.rows[0],
    globalStats: globalStats.rows[0],
  };
}
// ── Stats endpoint ───────────────────────────────────────
app.get("/api/stats", async (req: Request, res: Response) => {
  try {
    res.json(await statsFor(userFrom(req).id));
  } catch (e: any) {
    res.status(500).json({ error: "Failed to fetch stats", detail: e.message });
  }
});

// ── Personal weekly reading goal ───────────────────────────
app.get("/api/goals/weekly", async (req: Request, res: Response) => {
  try {
    const ownerId = userFrom(req).id;
    const today = dateInAppTz();
    const goal =
      (
        await query<WeeklyGoalRow>(
          "SELECT * FROM weekly_reading_goals WHERE owner_id=$1",
          [ownerId],
        )
      ).rows[0] || null;
    const { week_start: weekStart, week_end: weekEnd } = progressFor(
      goal,
      0,
      today,
    );
    const metricExpr =
      goal?.metric === "units"
        ? "COALESCE(SUM(rl.page_end - rl.page_start + 1), 0)"
        : "COUNT(*)";
    const result = await query<{ completed: string }>(
      `SELECT ${metricExpr} AS completed
       FROM reading_log rl JOIN books b ON b.id=rl.book_id
       WHERE b.owner_id=$1 AND rl.date >= $2::date AND rl.date <= $3::date`,
      [ownerId, weekStart, weekEnd],
    );
    res.json(progressFor(goal, Number(result.rows[0]?.completed || 0), today));
  } catch (e: any) {
    res
      .status(503)
      .json({ error: "weekly goal unavailable", detail: e.message });
  }
});

// ── Today key insights (small, personal, round-aware) ───────
app.get("/api/today/insights", async (req: Request, res: Response) => {
  const ownerId = userFrom(req).id;
  const bookId = typeof req.query.bookId === "string" ? req.query.bookId : "";
  const allBooks = req.query.allBooks === "1";
  const rawRound = req.query.round;
  if (
    typeof rawRound !== "undefined" &&
    (typeof rawRound !== "string" ||
      !/^\d+$/.test(rawRound) ||
      Number(rawRound) < 1)
  )
    return res.status(400).json({ error: "round must be a positive integer" });
  if (bookId && !/^[0-9a-f-]{36}$/i.test(bookId))
    return res.status(400).json({ error: "bookId must be a UUID" });
  if (allBooks && (bookId || rawRound !== undefined))
    return res
      .status(400)
      .json({ error: "allBooks cannot be combined with bookId or round" });
  try {
    const books = await query<{
      id: string;
      title: string;
      author: string;
      current_reading_round: number;
    }>(
      "SELECT id, title, author, current_reading_round FROM books WHERE owner_id=$1 ORDER BY title ASC, created_at ASC",
      [ownerId],
    );
    let selectedBook = bookId
      ? books.rows.find((book) => book.id === bookId)
      : undefined;
    if (!bookId && !allBooks)
      selectedBook = (
        await query<{
          id: string;
          title: string;
          author: string;
          current_reading_round: number;
        }>(
          "SELECT id, title, author, current_reading_round FROM books WHERE owner_id=$1 AND status='active' ORDER BY created_at ASC LIMIT 1",
          [ownerId],
        )
      ).rows[0];
    if (bookId && !selectedBook)
      return res.status(404).json({ error: "book not found" });
    const selectedRound = selectedBook
      ? rawRound === undefined
        ? Number(selectedBook.current_reading_round)
        : Number(rawRound)
      : null;
    let rounds: Array<{ reading_round: number; status: string }> = [];
    if (selectedBook) {
      rounds = (
        await query<{ reading_round: number; status: string }>(
          "SELECT reading_round, status FROM book_reading_rounds WHERE book_id=$1 ORDER BY reading_round DESC",
          [selectedBook.id],
        )
      ).rows;
      if (
        !rounds.some((round) => Number(round.reading_round) === selectedRound)
      )
        return res
          .status(404)
          .json({ error: "reading round not found for book" });
    }
    const params: unknown[] = [ownerId];
    let where = "b.owner_id=$1";
    if (selectedBook) {
      params.push(selectedBook.id, selectedRound);
      where += " AND rl.book_id=$2 AND rl.reading_round=$3";
    }
    const insights = await query<{ insight: string; occurrences: string }>(
      `WITH source_rows AS (
         SELECT regexp_replace(btrim(source.insight), '\\s+', ' ', 'g') AS display_insight,
                lower(regexp_replace(btrim(source.insight), '\\s+', ' ', 'g')) AS normalized_insight
         FROM reading_log rl
         JOIN books b ON b.id=rl.book_id
         CROSS JOIN LATERAL unnest(COALESCE(rl.key_insights, ARRAY[]::text[])) AS source(insight)
         WHERE ${where}
       )
       SELECT (array_agg(display_insight ORDER BY display_insight))[1] AS insight,
              COUNT(*)::text AS occurrences
       FROM source_rows
       WHERE normalized_insight <> ''
       GROUP BY normalized_insight
       ORDER BY COUNT(*) DESC, normalized_insight ASC
       LIMIT 8`,
      params,
    );
    res.json({
      selection: {
        all_books: allBooks,
        book_id: selectedBook?.id || null,
        reading_round: selectedRound,
      },
      books: books.rows,
      rounds,
      insights: insights.rows.map((row) => ({
        text: row.insight,
        occurrences: Number(row.occurrences),
      })),
    });
  } catch (e: any) {
    res
      .status(503)
      .json({ error: "today insights unavailable", detail: e.message });
  }
});

// ── Today dashboard (personal retention loop) ──────────────
app.get("/api/today", async (req: Request, res: Response) => {
  try {
    const ownerId = userFrom(req).id;
    const appToday = dateInAppTz();
    const [active, queued, todayLogs, dueReviews, goalRow] = await Promise.all([
      query(
        `SELECT * FROM books WHERE owner_id=$1 AND status='active' ORDER BY created_at ASC`,
        [ownerId],
      ),
      query(
        `SELECT * FROM books WHERE owner_id=$1 AND status='queued' ORDER BY queue_order NULLS LAST, created_at ASC LIMIT 1`,
        [ownerId],
      ),
      query<{ sessions: string; units: string }>(
        `SELECT COUNT(*) AS sessions, COALESCE(SUM(rl.page_end - rl.page_start + 1), 0) AS units
         FROM reading_log rl JOIN books b ON b.id=rl.book_id
         WHERE b.owner_id=$1 AND rl.date=$2::date`,
        [ownerId, appToday],
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM review_cards rc JOIN books b ON b.id=rc.book_id
         WHERE b.owner_id=$1 AND rc.due_date <= $2::date`,
        [ownerId, appToday],
      ),
      query<WeeklyGoalRow>(
        "SELECT * FROM weekly_reading_goals WHERE owner_id=$1",
        [ownerId],
      ),
    ]);
    const goal = goalRow.rows[0] || null;
    const bounds = progressFor(goal, 0, appToday);
    const metricExpr =
      goal?.metric === "units"
        ? "COALESCE(SUM(rl.page_end - rl.page_start + 1), 0)"
        : "COUNT(*)";
    const weekly = await query<{ completed: string }>(
      `SELECT ${metricExpr} AS completed FROM reading_log rl JOIN books b ON b.id=rl.book_id
       WHERE b.owner_id=$1 AND rl.date >= $2::date AND rl.date <= $3::date`,
      [ownerId, bounds.week_start, bounds.week_end],
    );
    res.json({
      today: appToday,
      active_books: active.rows,
      active_book: active.rows[0] || null,
      next_queued_book: queued.rows[0] || null,
      today_progress: {
        sessions: Number(todayLogs.rows[0]?.sessions || 0),
        units: Number(todayLogs.rows[0]?.units || 0),
      },
      due_reviews: Number(dueReviews.rows[0]?.count || 0),
      weekly_goal: progressFor(
        goal,
        Number(weekly.rows[0]?.completed || 0),
        appToday,
      ),
    });
  } catch (e: any) {
    res
      .status(503)
      .json({ error: "today dashboard unavailable", detail: e.message });
  }
});

app.put("/api/goals/weekly", async (req: Request, res: Response) => {
  const metric = req.body?.metric as WeeklyGoalMetric;
  const target = Number(req.body?.target);
  if (
    (metric !== "sessions" && metric !== "units") ||
    !Number.isInteger(target) ||
    target < 1 ||
    target > 10000
  ) {
    return res
      .status(400)
      .json({
        error:
          "metric must be sessions or units and target must be an integer from 1 to 10000",
      });
  }
  try {
    const { rows } = await query<WeeklyGoalRow>(
      `INSERT INTO weekly_reading_goals (owner_id, metric, target)
       VALUES ($1,$2,$3)
       ON CONFLICT (owner_id) DO UPDATE SET metric=EXCLUDED.metric, target=EXCLUDED.target, updated_at=now()
       RETURNING *`,
      [userFrom(req).id, metric, target],
    );
    res.json(rows[0]);
  } catch (e: any) {
    res
      .status(503)
      .json({ error: "could not save weekly goal", detail: e.message });
  }
});

// ── Serve frontend assets in production / development ─────────
async function startServer() {
  // Ensure DB schema on boot if a database is configured.
  if (process.env.DATABASE_URL) {
    try {
      await ensureSchema();
      await verifyCoreSchema();
      startPodcastMaintenance();
    } catch (e: any) {
      console.error(
        "[db] schema bootstrap failed; refusing to start:",
        e.message,
      );
      process.exitCode = 1;
      return;
    }
  } else {
    console.warn(
      "[db] DATABASE_URL not set — /api/books routes will be unavailable",
    );
  }

  // ── Knowledge Mindmap ─────────────────────────────────────────
  app.post("/api/books/:id/mindmap", async (req: Request, res: Response) => {
    try {
      const owned = await query(
        "SELECT id FROM books WHERE id=$1 AND owner_id=$2",
        [req.params.id, userFrom(req).id],
      );
      if (!owned.rows.length)
        return res
          .status(403)
          .json({ error: "Only the owner may modify this resource" });
      const { id } = req.params;
      const book = (
        await query(`SELECT * FROM chapter.books WHERE id = $1`, [id])
      ).rows[0];
      if (!book) return res.status(404).json({ error: "Book not found" });
      if (book.reading_experience === "story") {
        return res
          .status(400)
          .json({ error: "Story Thread books do not use Knowledge Maps" });
      }

      const { rows: logs } = await query(
        `SELECT * FROM chapter.reading_log WHERE book_id = $1 ORDER BY date DESC`,
        [id],
      );

      const allInsights = logs.flatMap((l: any) => l.key_insights || []);
      const allSummaries = logs
        .map((l: any) => l.summary)
        .filter(Boolean)
        .join("\n\n");

      if (allInsights.length === 0 && !allSummaries) {
        return res.json(null);
      }

      const prompt = `You are helping a reader understand the key concepts in "${book.title}" by ${book.author}.

Here are all the key insights collected across their reading sessions:
${allInsights.map((i: string, n: number) => `${n + 1}. ${i}`).join("\n")}

Here are the session summaries:
${allSummaries}

Return ONLY a JSON object with this exact structure:
{
  "root": "One sentence thesis of the whole book",
  "branches": [
    {
      "theme": "Theme name (2-4 words)",
      "color": "#hex color",
      "nodes": [{ "text": "specific insight grounded in the supplied sessions", "evidence": "brief supporting detail from a supplied insight or summary, only when present", "page": 12 }]
    }
  ]
}

Use 3-5 branches. Each branch should have 2-4 nodes. Colors should be calm, warm, and distinct. Do not invent evidence or page numbers: omit evidence and page whenever the supplied material does not establish them. Existing clients may also read legacy string nodes.
Return only valid JSON, no markdown, no explanation.`;

      const raw = await callLLM(
        "You are a knowledge synthesis expert.",
        prompt,
        0.3,
      );
      res.json(JSON.parse(raw));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Serve SPA ─────────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use("/assets", express.static(path.join(distPath, "assets"), { immutable: true, maxAge: "1y" }));
    app.use(express.static(distPath, { index: false }));
    app.get("*", (_req: Request, res: Response) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
