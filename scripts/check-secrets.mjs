#!/usr/bin/env node
// Fails if the Supabase secret key (name or value prefix) appears in anything the browser can load,
// or in any "use client" source file.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const NEEDLES = ["SUPABASE_SECRET_KEY", "sb_secret_"];
const secretValue = process.env.SUPABASE_SECRET_KEY;
if (secretValue && secretValue.length > 12) NEEDLES.push(secretValue);
if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length > 12) NEEDLES.push(process.env.SESSION_SECRET);

const walk = (dir) =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? walk(p) : [p];
      })
    : [];

const hits = [];
const browserDirs = [".next/static", ".open-next/assets"];
for (const f of browserDirs.flatMap(walk)) {
  if (!/\.(js|css|html|json|txt|map)$/.test(f)) continue;
  const t = readFileSync(f, "utf8");
  for (const n of NEEDLES) if (t.includes(n)) hits.push(`${relative(".", f)} contains ${n.startsWith("sb_") || n.length < 25 ? n : "(secret value)"}`);
}
for (const f of ["app", "components", "lib"].flatMap(walk)) {
  if (!/\.(ts|tsx)$/.test(f)) continue;
  const t = readFileSync(f, "utf8");
  if (!/^\s*["']use client["']/.test(t)) continue;
  for (const n of NEEDLES) if (t.includes(n)) hits.push(`${relative(".", f)} ("use client") contains ${n.length < 25 ? n : "(secret value)"}`);
}
if (!walk(".next/static").length) console.warn("check-secrets: .next/static not found — run `next build` first for a full check.");
if (hits.length) {
  console.error("check-secrets: SECRET LEAK\n" + hits.map((h) => "  " + h).join("\n"));
  process.exit(1);
}
console.log("check-secrets: OK — no secret key in client bundles or client components.");
