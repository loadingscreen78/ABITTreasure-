// Creates (or updates) Supabase Auth users for organisers with app_metadata.role, using the secret key.
//   node --env-file=.env.local scripts/create-organisers.mjs admin=you@example.com judge=judge@example.com
// Passwords are random and written ONCE to a gitignored organisers-<date>.txt (never printed in CI logs).
import { writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const pairs = process.argv.slice(2).map((a) => a.split("=")).filter(([r, e]) => (r === "admin" || r === "judge") && e?.includes("@"));
if (!pairs.length) {
  console.error("usage: create-organisers.mjs admin=email judge=email [judge=email2 ...]");
  process.exit(1);
}
const { data: list, error: listErr } = await db.auth.admin.listUsers({ perPage: 1000 });
if (listErr) throw new Error(listErr.message);
const lines = [];
for (const [role, email] of pairs) {
  const password = randomBytes(12).toString("base64url");
  const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  const res = existing
    ? await db.auth.admin.updateUserById(existing.id, { password, app_metadata: { ...existing.app_metadata, role } })
    : await db.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role } });
  if (res.error) {
    console.error(`${role} ${email}: ${res.error.message}`);
    continue;
  }
  lines.push(`${role}\t${email}\t${password}`);
  console.log(`${existing ? "updated" : "created"} ${role}: ${email}`);
}
if (lines.length) {
  const out = `organisers-${new Date().toISOString().slice(0, 10)}.txt`;
  writeFileSync(out, "ROLE\tEMAIL\tPASSWORD\n" + lines.join("\n") + "\n");
  console.log(`passwords saved to ${out} (gitignored) — store them safely, then delete the file.`);
}
