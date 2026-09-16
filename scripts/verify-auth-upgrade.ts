import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const checks: Array<[string, string, RegExp]> = [
  ["schema", "src/db/schema.sql", /password_reset_tokens[\s\S]*token_hash TEXT NOT NULL UNIQUE/],
  ["schema", "src/db/schema.sql", /ALTER COLUMN password_hash DROP NOT NULL/],
  ["schema", "src/db/schema.sql", /environment TEXT NOT NULL DEFAULT 'prd'/],
  ["schema", "src/db/schema.sql", /users_environment_check CHECK \(environment IN \('prd', 'dev'\)\)/],
  ["server", "server.ts", /app\.post\("\/api\/auth\/forgot-password"/],
  ["server", "server.ts", /tokenHash\(rawToken\)/],
  ["server", "server.ts", /req\.session\.regenerate/],
  ["server", "server.ts", /code_challenge_method: "S256"/],
  ["server", "server.ts", /verifyIdToken/],
  ["server", "server.ts", /payload\.nonce !== pending\.nonce/],
  ["server", "server.ts", /\/api\/auth\/google-merge/],
  ["server", "server.ts", /withTransaction/],
  ["server", "server.ts", /source\.environment !== destination\.environment/],
  ["server", "server.ts", /expiresAt: Date\.now\(\) \+ 10 \* 60_000/],
  ["server", "server.ts", /DELETE FROM chapter\.session WHERE sess->'user'->>'id'=\$1/],
  ["server", "server.ts", /UPDATE chapter\.users SET google_sub=\$1, email=COALESCE\(email,\$2\)/],
  ["profile", "src\/pages\/Profile.tsx", /Merge accounts/],
  ["mail", "src/email.ts", /sendPasswordResetEmail/],
  ["login", "src/components/Login.tsx", /Continue with Google/],
  ["login", "src/components/Login.tsx", /Forgot password\?/],
  ["routes", "src/App.tsx", /forgot-password/],
  ["env", ".env.example", /RESEND_API_KEY=re_replace-me/],
];
for (const [name, file, pattern] of checks) {
  if (!pattern.test(read(file))) throw new Error(`${name} contract missing: ${file}`);
}
console.log("AUTH_UPGRADE_CONTRACT_OK");
