import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const server = read("server.ts"), auth = read("src/auth.ts"), limiter = read("src/auth-rate-limit.ts"), app = read("src/App.tsx"), login = read("src/components/Login.tsx"), signup = read("src/components/Signup.tsx"), schema = read("src/db/schema.sql");
for (const [name, text, expected] of [["route", server, '/api/auth/signup'], ["session intent", auth, '"signup"'], ["limiter", limiter, 'scope: "signup"'], ["signup UI", signup, 'intent=signup'], ["auth route", app, 'path="/signup"'], ["login link", login, 'to="/signup"'], ["schema", schema, "'signup'"]] as const) if (!text.includes(expected)) throw new Error(`Missing ${name}: ${expected}`);
if (!server.includes("lower(email)=lower($3)")) throw new Error("Login must support scoped email or username");
console.log("AUTH_SIGNUP_CONTRACT_OK");
