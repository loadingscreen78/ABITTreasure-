#!/usr/bin/env node
// Load test: N teams × 2 phones play the whole hunt concurrently against a deployment.
//   node --env-file=.env.local scripts/load-test.mjs <baseUrl> [teams=40]
// Creates temporary REHEARSAL teams T900+ (they can play before START and never appear in results),
// then deletes them. Targets: p95 < 600 ms, zero 5xx, zero double-awards.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/+$/, "");
const N = Number(process.argv[3] ?? 40);
const hunt = JSON.parse(readFileSync("content/hunt.json", "utf8"));
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const PW = "LDTESTPW";
const ids = Array.from({ length: N }, (_, i) => `T${900 + i}`);

const lat = [];
let s5xx = 0;
let errors = 0;

function phone(name) {
  let cookie = "";
  return async (path, body) => {
    const t0 = performance.now();
    let res;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        res = await fetch(BASE + path, {
          method: body === undefined ? "GET" : "POST",
          headers: { "Content-Type": "application/json", "x-device-id": `load-${name}`, ...(cookie ? { cookie } : {}) },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        break;
      } catch {
        await new Promise((r) => setTimeout(r, [400, 1000, 2000][attempt] ?? 2000));
      }
    }
    lat.push(performance.now() - t0);
    if (!res) {
      errors++;
      return { status: 0, data: null };
    }
    if (res.status >= 500) s5xx++;
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* ignore */
    }
    return { status: res.status, data };
  };
}

async function play(id, tokens, answers) {
  const A = phone(id + "a");
  const B = phone(id + "b");
  await A("/api/team/login", { teamId: id, password: PW });
  await B("/api/team/login", { teamId: id, password: PW });
  for (const cp of hunt.checkpoints) {
    // both phones scan the same QR at the same time
    await Promise.all([A("/api/team/scan", { token: tokens[cp.code] }), B("/api/team/scan", { token: tokens[cp.code] })]);
    for (const q of cp.questions) {
      // both phones submit the correct answer simultaneously → exactly one may score
      await Promise.all([
        A("/api/team/submit", { questionId: q.id, answer: answers[q.id], idemKey: `${id}-${q.id}-a` }),
        B("/api/team/submit", { questionId: q.id, answer: answers[q.id], idemKey: `${id}-${q.id}-b` }),
      ]);
    }
    await B("/api/team/state");
  }
}

async function main() {
  const { data: cps } = await db.from("checkpoints").select("code, token");
  const tokens = Object.fromEntries(cps.map((c) => [c.code, c.token]));
  const { data: ev } = await db.from("event_state").select("settings").eq("id", 1).single();
  const answers = Object.fromEntries(hunt.checkpoints.flatMap((c) => c.questions.map((q) => [q.id, q.match === "secret-word" ? ev.settings.secretWord : q.accept[0]])));

  console.log(`load-test: creating ${N} temporary rehearsal teams…`);
  const hash = await bcrypt.hash(PW, Number(process.env.BCRYPT_COST ?? 5));
  await db.from("teams").delete().in("id", ids);
  const { error } = await db.from("teams").insert(ids.map((id) => ({ id, name: `Load ${id}`, members: ["load"], password_hash: hash, is_rehearsal: true })));
  if (error) throw new Error(error.message);

  console.log(`load-test: ${N} teams × 2 phones → ${BASE}`);
  const t0 = Date.now();
  await Promise.all(ids.map((id) => play(id, tokens, answers)));
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  // verify ledger: exactly 15 clue refs + final, 75 + 15 marks, finished
  const { data: rows } = await db.from("score_entries").select("team_id, ref, marks").in("team_id", ids);
  const { data: teams } = await db.from("teams").select("id, status").in("id", ids);
  let bad = 0;
  for (const id of ids) {
    const r = rows.filter((x) => x.team_id === id);
    const clue = r.filter((x) => x.ref.startsWith("clue:"));
    const ok = clue.length === 15 && clue.reduce((s, x) => s + x.marks, 0) === 75 && r.filter((x) => x.ref === "final").length === 1 && teams.find((t) => t.id === id)?.status === "FINISHED";
    if (!ok) bad++;
  }
  lat.sort((a, b) => a - b);
  const p = (q) => lat[Math.min(lat.length - 1, Math.floor(q * lat.length))].toFixed(0);
  console.log(`\nrequests: ${lat.length} in ${secs}s · p50 ${p(0.5)} ms · p95 ${p(0.95)} ms · p99 ${p(0.99)} ms · max ${lat.at(-1).toFixed(0)} ms`);
  console.log(`5xx: ${s5xx} · network errors: ${errors} · teams with wrong/double marks or unfinished: ${bad}/${N}`);

  await db.from("scan_logs").delete().in("team_id", ids);
  await db.from("teams").delete().in("id", ids);
  console.log("load-test: temporary teams deleted.");
  const pass = Number(p(0.95)) < 600 && s5xx === 0 && bad === 0;
  console.log(pass ? "load-test: PASS" : "load-test: TARGETS NOT MET");
  process.exit(pass ? 0 : 1);
}

main().catch(async (e) => {
  console.error("load-test crashed:", e.message);
  await db.from("teams").delete().in("id", ids);
  process.exit(1);
});
