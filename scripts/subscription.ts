import dotenv from "dotenv";
import { withClient } from "../src/db.js";
import { type GrantSource, type SubscriptionStatus, type Tier } from "../src/entitlements.js";

dotenv.config({ path: ".env.local", override: true });

const appEnv = process.env.APP_ENV;
if (appEnv !== "prd" && appEnv !== "dev") throw new Error("APP_ENV must be exactly 'prd' or 'dev'");

const [command, ...args] = process.argv.slice(2);
const valueFor = (key: string) => { const index = args.indexOf(key); return index >= 0 ? args[index + 1] : undefined; };
const username = valueFor("--username");
const tier = valueFor("--tier");
const status = valueFor("--status");
const source = valueFor("--source");
const until = valueFor("--until");
const tiers: Tier[] = ["free", "plus", "deep_reader"];
const statuses: SubscriptionStatus[] = ["active", "trialing", "canceled", "past_due", "expired"];
const sources: GrantSource[] = ["payment", "trial", "admin", "founding"];

if (command !== "grant" && command !== "expire") throw new Error("Usage: grant-subscription -- --username <name> --tier plus --status active --source admin --until YYYY-MM-DD | expire-subscription -- --username <name>");
if (!username || !/^[A-Za-z0-9_-]{1,60}$/.test(username)) throw new Error("a valid --username is required");
if (command === "grant" && (!tiers.includes(tier as Tier) || !statuses.includes(status as SubscriptionStatus) || !sources.includes(source as GrantSource))) throw new Error("invalid --tier, --status, or --source");
if (command === "grant" && (!until || !/^\d{4}-\d{2}-\d{2}$/.test(until) || Number.isNaN(Date.parse(`${until}T23:59:59Z`)))) throw new Error("--until must be YYYY-MM-DD");

await withClient(async (client) => {
  const user = (await client.query("SELECT id FROM chapter.users WHERE username=$1 AND environment=$2", [username, appEnv])).rows[0];
  if (!user) throw new Error("user not found in this environment");
  if (command === "expire") {
    await client.query("INSERT INTO chapter.subscriptions (user_id,tier,status,granted_by,current_period_end,updated_at) VALUES ($1,'free','expired','admin',now(),now()) ON CONFLICT (user_id) DO UPDATE SET tier='free',status='expired',granted_by='admin',current_period_end=now(),updated_at=now()", [user.id]);
    console.log(`expired subscription for ${username}`);
    return;
  }
  await client.query("INSERT INTO chapter.subscriptions (user_id,tier,status,granted_by,current_period_end,updated_at) VALUES ($1,$2,$3,$4,$5::date + interval '1 day' - interval '1 second',now()) ON CONFLICT (user_id) DO UPDATE SET tier=EXCLUDED.tier,status=EXCLUDED.status,granted_by=EXCLUDED.granted_by,current_period_end=EXCLUDED.current_period_end,updated_at=now()", [user.id, tier, status, source, until]);
  console.log(`granted ${tier} (${status}, ${source}) to ${username} until ${until}`);
});
