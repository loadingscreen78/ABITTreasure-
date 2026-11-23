// Applies supabase/migrations/*.sql to the real project with the Supabase CLI (`supabase db push`).
// Builds the pooler connection URL from .env.local; never prints the password.
// Alternative: run `npx supabase link --project-ref <ref>` once, then `npx supabase db push`.
import { spawnSync } from "node:child_process";

const ref = process.env.SUPABASE_PROJECT_REF;
const pw = process.env.SUPABASE_DB_PASSWORD;
const host = process.env.SUPABASE_POOLER_HOST;
if (!ref || !pw || !host) {
  console.error("db-push: set SUPABASE_PROJECT_REF, SUPABASE_DB_PASSWORD and SUPABASE_POOLER_HOST in .env.local");
  console.error("        (find the host with: node --env-file=.env.local scripts/find-pooler.mjs)");
  process.exit(1);
}
const url = `postgresql://postgres.${ref}:${encodeURIComponent(pw)}@${host}:5432/postgres`;
const extra = process.argv.slice(2);
const r = spawnSync("npx", ["--yes", "supabase", "db", "push", "--db-url", url, "--include-all", ...extra], {
  stdio: ["inherit", "pipe", "pipe"],
  shell: process.platform === "win32",
  encoding: "utf8",
});
const scrub = (s) => (s ?? "").split(encodeURIComponent(pw)).join("****").split(pw).join("****");
process.stdout.write(scrub(r.stdout));
process.stderr.write(scrub(r.stderr));
process.exit(r.status ?? 1);
