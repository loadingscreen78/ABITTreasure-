#!/usr/bin/env node
// Section 3: after `next build`, assert that no riddle, nudge, secret word or accept value longer
// than 3 chars appears in any client bundle. Uses the real (gitignored) hunt.json when present.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const file = existsSync("content/hunt.json") ? "content/hunt.json" : "content/hunt.example.json";
const hunt = JSON.parse(readFileSync(file, "utf8"));
const needles = new Set();
// Generic English / programming words that occur in any framework bundle (React, supabase-js)
// and so cannot identify an answer, plus strings that are part of the public event branding
// (the final phrase is the first word of the event title).
const GENERIC = new Set(["none", "null", "nil", "nothing", "no answer", "not possible", "impossible", "no number", "no solution", "does not exist", "doesnt exist", "anchor", "eleven"]);
const branding = [hunt.event.title, hunt.event.series, hunt.event.tagline, hunt.event.institute].join(" ").toLowerCase();
const add = (s) => {
  if (typeof s !== "string") return;
  const t = s.trim();
  if (t.length <= 3 || GENERIC.has(t.toLowerCase())) return;
  if (branding.split(/[^a-z0-9]+/).includes(t.toLowerCase())) return;
  needles.add(t);
};
add(hunt.settings.secretWord);
add(process.env.SECRET_WORD);
for (const cp of hunt.checkpoints) {
  if (cp.reveal) {
    add(cp.reveal.riddle);
    add(cp.reveal.nudge);
  }
  if (cp.arrivalCredit) add(cp.arrivalCredit.answer);
  for (const q of cp.questions) {
    for (const a of q.accept) if (!a.startsWith("{{")) add(a);
    for (const m of Object.values(q.nearMiss)) add(m);
    add(q.prompt);
  }
}

const walk = (dir) =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? walk(p) : [p];
      })
    : [];

const dirs = [".next/static", ".open-next/assets"].filter(existsSync);
if (!dirs.length) {
  console.error("check-leaks: no build output — run `next build` first.");
  process.exit(1);
}
const hits = [];
for (const f of dirs.flatMap(walk)) {
  if (!/\.(js|css|html|json|txt|rsc)$/.test(f)) continue;
  const text = readFileSync(f, "utf8").toLowerCase();
  for (const n of needles) {
    const needle = n.toLowerCase();
    // whole-word match for short values so e.g. "none" inside library code isn't a false hit
    const re = needle.length <= 8 ? new RegExp(`["'\`>]${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'\`<]`) : null;
    if (re ? re.test(text) : text.includes(needle)) hits.push(`${relative(".", f)} ← "${n.slice(0, 40)}${n.length > 40 ? "…" : ""}"`);
  }
}
if (hits.length) {
  console.error(`check-leaks: ${hits.length} content leak(s) in client bundles (source: ${file})\n` + hits.map((h) => "  " + h).join("\n"));
  process.exit(1);
}
console.log(`check-leaks: OK — ${needles.size} riddle/answer strings from ${file}, none in client bundles.`);
