import dotenv from "dotenv";
import bcrypt from "bcrypt";
import { withClient } from "../src/db.js";

// tsx does not automatically load .env.local, unlike the app server.
dotenv.config({ path: ".env.local" });

const [command, username, ...args] = process.argv.slice(2);
if (!command || !username) throw new Error("Usage: create-user <username> <display-name> <password> | delete-user <username> | reset-password <username> <new-password>");

if (command === "create") {
  const [displayName, password] = args;
  if (!displayName) throw new Error("display name required");
  if (!password) throw new Error("password required");
  await withClient(async client => {
    const result = await client.query("INSERT INTO chapter.users (username, password_hash, display_name) VALUES ($1,$2,$3) RETURNING id", [username, await bcrypt.hash(password, 12), displayName]);
    console.log(`created user ${username} (${result.rows[0].id})`);
  });
} else if (command === "reset-password") {
  const [password] = args;
  if (!password) throw new Error("password required");
  await withClient(async client => {
    const result = await client.query("UPDATE chapter.users SET password_hash=$1 WHERE username=$2", [await bcrypt.hash(password, 12), username]);
    if (!result.rowCount) throw new Error("user not found");
  });
} else if (command === "delete") {
  const adminUsername = process.env.ADMIN_USERNAME;
  if (!adminUsername) throw new Error("ADMIN_USERNAME must name the account receiving transferred data");
  if (adminUsername === username) throw new Error("ADMIN_USERNAME must differ from the deleted user");
  await withClient(async client => {
    await client.query("BEGIN");
    try {
      const user = (await client.query("SELECT id FROM chapter.users WHERE username=$1 FOR UPDATE", [username])).rows[0];
      const admin = (await client.query("SELECT id FROM chapter.users WHERE username=$1 FOR UPDATE", [adminUsername])).rows[0];
      if (!user) throw new Error("user not found");
      if (!admin) throw new Error("ADMIN_USERNAME user not found");
      const transferredBooks = await client.query("UPDATE chapter.books SET owner_id=$1 WHERE owner_id=$2", [admin.id, user.id]);
      await client.query("DELETE FROM chapter.users WHERE id=$1", [user.id]);
      await client.query("COMMIT");
      console.log(`deleted user ${username}; transferred ${transferredBooks.rowCount ?? 0} book(s) to ${adminUsername}`);
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
} else throw new Error("unknown command");

if (command === "reset-password") console.log(`reset password for ${username}`);
