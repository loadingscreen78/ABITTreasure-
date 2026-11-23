// Cloudflare build that never bakes secrets into the Worker.
// OpenNext copies .env* files into the bundle (next-env.mjs). So: hide .env.local for the duration
// of the build and pass only the two browser-safe NEXT_PUBLIC_* values. Real secrets are set
// separately in Cloudflare's encrypted store (`npm run cf:secrets`).
import { existsSync, readFileSync, renameSync } from "node:fs";
import { spawnSync } from "node:child_process";

const LOCAL = ".env.local";
const HIDDEN = ".env.local.cf-build-hidden";
const parse = (t) => Object.fromEntries(t.split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/\s+#.*$/, "").trim()]));
const local = existsSync(LOCAL) ? parse(readFileSync(LOCAL, "utf8")) : {};
const pick = (k) => process.env[k] ?? local[k] ?? "";

if (existsSync(HIDDEN)) renameSync(HIDDEN, LOCAL); // recover from a crashed previous run
const restore = () => existsSync(HIDDEN) && renameSync(HIDDEN, LOCAL);
for (const sig of ["SIGINT", "SIGTERM", "exit"]) process.on(sig, () => { restore(); if (sig !== "exit") process.exit(1); });

if (existsSync(LOCAL)) renameSync(LOCAL, HIDDEN);
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: pick("NEXT_PUBLIC_SUPABASE_URL"), NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: pick("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") };
for (const k of ["SUPABASE_SECRET_KEY", "SESSION_SECRET", "SUPABASE_DB_PASSWORD"]) delete env[k];
let status = 1;
try {
  const r = spawnSync("npx", ["opennextjs-cloudflare", "build", ...process.argv.slice(2)], { stdio: "inherit", env, shell: process.platform === "win32" });
  status = r.status ?? 1;
} finally {
  restore();
}
// Belt and braces: fail if any secret value made it into the Worker output.
if (status === 0 && existsSync(".open-next/cloudflare/next-env.mjs")) {
  const t = readFileSync(".open-next/cloudflare/next-env.mjs", "utf8");
  for (const k of ["SUPABASE_SECRET_KEY", "SESSION_SECRET", "SUPABASE_DB_PASSWORD"]) {
    if (local[k] && t.includes(local[k])) {
      console.error(`cf-build: ${k} leaked into the Worker bundle — aborting.`);
      process.exit(1);
    }
  }
  console.log("cf-build: OK — no secrets in the Worker bundle.");
}
process.exit(status);
