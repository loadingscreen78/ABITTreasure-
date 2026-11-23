// Pushes runtime config from .env.local into the Cloudflare Worker's encrypted secrets
// (`wrangler secret bulk`). Values are never printed. Optional: PUBLIC_BASE_URL=... override.
//   node --env-file=.env.local scripts/cf-secrets.mjs [PUBLIC_BASE_URL]
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const keys = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "SUPABASE_JWKS_URL", "SESSION_SECRET", "PUBLIC_BASE_URL"];
const values = Object.fromEntries(keys.map((k) => [k, process.env[k] ?? ""]).filter(([, v]) => v));
if (process.argv[2]) values.PUBLIC_BASE_URL = process.argv[2];
const missing = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "SESSION_SECRET", "PUBLIC_BASE_URL"].filter((k) => !values[k]);
if (missing.length) {
  console.error("cf-secrets: missing " + missing.join(", "));
  process.exit(1);
}
const dir = mkdtempSync(join(tmpdir(), "cfsec-"));
const file = join(dir, "secrets.json");
try {
  writeFileSync(file, JSON.stringify(values), { mode: 0o600 });
  const r = spawnSync("npx", ["wrangler", "secret", "bulk", file], { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", shell: process.platform === "win32" });
  const scrub = (s) => Object.values(values).reduce((acc, v) => (v.length > 6 ? acc.split(v).join("****") : acc), s ?? "");
  process.stdout.write(scrub(r.stdout));
  process.stderr.write(scrub(r.stderr));
  console.log(`cf-secrets: pushed ${Object.keys(values).join(", ")} (PUBLIC_BASE_URL=${values.PUBLIC_BASE_URL})`);
  process.exit(r.status ?? 1);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
