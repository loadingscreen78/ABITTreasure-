#!/usr/bin/env node
// API-level end-to-end run for rehearsal team T00 against a running app (local or deployed).
//   node --env-file=.env.local scripts/smoke.mjs [baseUrl]
// Uses the secret key ONLY to give T00 a fresh known password and reset its progress, then plays
// the whole hunt over HTTP exactly like a phone would, checking every reveal against hunt.json.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const BASE = (process.argv[2] ?? process.env.SMOKE_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const hunt = JSON.parse(readFileSync("content/hunt.json", "utf8"));
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) failures++;
};

function jar() {
  let cookie = "";
  const device = "smoke-" + Math.random().toString(36).slice(2, 10);
  return async (path, body) => {
    const res = await fetch(BASE + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", "x-device-id": device, ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, data };
  };
}

async function main() {
  console.log(`smoke: ${BASE}`);
  const { data: cps, error } = await db.from("checkpoints").select("code, ord, token").order("ord");
  if (error) throw new Error(error.message);
  const tok = Object.fromEntries(cps.map((c) => [c.code, c.token]));
  const { data: ev } = await db.from("event_state").select("settings").eq("id", 1).single();
  const secret = ev.settings.secretWord;
  const FULL = ev.settings.fullMarksWithinAttempts ?? 3;

  // fresh T00 credentials + progress
  const pw = "SMKTEST";
  const { data: t } = await db.from("teams").select("session_version").eq("id", "T00").single();
  await db.from("teams").update({ password_hash: await bcrypt.hash(pw, 5), session_version: (t?.session_version ?? 1) + 1 }).eq("id", "T00");
  await db.rpc("reset_team", { p_team_id: "T00" });

  // Age T00's past attempts out of the 60 s answer rate-limit window (test helper only).
  const ageAttempts = () => db.from("attempts").update({ at: new Date(Date.now() - 180_000).toISOString() }).eq("team_id", "T00");
  const A = jar();
  const B = jar();

  // GET of the QR URL changes nothing
  const page = await fetch(`${BASE}/s/${tok["CP-01"]}`);
  ok(page.status === 200, "GET /s/<token> renders (200)");
  const { data: after } = await db.from("arrivals").select("id").eq("team_id", "T00");
  ok((after ?? []).length === 0, "GET did not create an arrival");

  let r = await A("/api/team/scan", { token: tok["CP-01"] });
  ok(r.data?.view?.kind === "login" && r.data.view.cp === 1, "not logged in → login view with CP 1");
  r = await A("/api/team/login", { teamId: "t0", password: "WRONG-PW" });
  ok(r.status === 401, "wrong password rejected");
  r = await A("/api/team/login", { teamId: "T00", password: "SMKT-EST", token: tok["CP-01"] });
  ok(r.data?.ok === true, "login with dashed password works");

  // out-of-order scan reveals nothing new
  r = await A("/api/team/scan", { token: tok["CP-03"] });
  ok(r.data?.view?.kind === "start" && r.data.view.banner === "WRONG_TURN", "future checkpoint → WRONG TURN, nothing revealed");

  const answers = { Q01: "C.P.U", Q03: "A", Q05: "C", Q07: "no such number", Q08: "cpu", Q10: "<a>", Q12: secret, Q14: "11", Q15: "T-E-C-H" };

  for (let i = 0; i < 8; i++) {
    const cp = hunt.checkpoints[i];
    r = await A("/api/team/scan", { token: tok[cp.code] });
    ok(r.data?.view?.kind === "question" && r.data.view.cp.order === cp.order, `${cp.code}: arrived, question shown`);
    if (cp.arrivalCredit) ok(r.data.view.cp.arrival?.marks === 5, `${cp.code}: location clue ${cp.arrivalCredit.clue} credited +5`);
    for (const [qi, q] of cp.questions.entries()) {
      r = await A("/api/team/state");
      ok(r.data?.view?.question?.id === q.id, `${cp.code}: current question is ${q.id} (${qi + 1}/${cp.questions.length})`);
      if (q.id === "Q01") {
        // near miss + wrong attempts
        let s = await A("/api/team/submit", { questionId: q.id, answer: "processor", idemKey: "smoke-nm-1" });
        ok(s.data?.result?.outcome === "NEAR_MISS", "Q01: near-miss does not count");
        s = await A("/api/team/submit", { questionId: q.id, answer: "gpu", idemKey: "smoke-w-1" });
        ok(s.data?.result?.outcome === "WRONG" && s.data.result.attemptsLeft === FULL - 1, `Q01: wrong → ${FULL - 1} attempts left for full marks`);
        const replay = await A("/api/team/submit", { questionId: q.id, answer: "gpu", idemKey: "smoke-w-1" });
        ok(replay.data?.result?.attemptNo === 1, "Q01: retried submit with same idempotency key is not counted twice");
      }
      if (q.id === "Q03") {
        await ageAttempts();
        for (let k = 1; k <= FULL + 1; k++) {
          await A("/api/team/submit", { questionId: q.id, answer: `wrong${k}`, idemKey: `smoke-q3-${k}` });
          await ageAttempts();
        }
        const s = await A("/api/team/submit", { questionId: q.id, answer: answers[q.id], idemKey: "smoke-q3-ok" });
        ok(s.data?.result?.outcome === "COOLDOWN", `Q03: after ${FULL + 1} wrong answers a cooldown blocks submits`);
        await db.from("teams").update({ cooldown_until: null }).eq("id", "T00");
      }
      if (q.id === "Q05") {
        // answer rate limit: 5 wrong/near-miss tries per minute, then every submit is refused
        await ageAttempts();
        for (let k = 1; k <= 5; k++) await A("/api/team/submit", { questionId: q.id, answer: "c++", idemKey: `smoke-rl-${k}` });
        const rl = await A("/api/team/submit", { questionId: q.id, answer: answers[q.id], idemKey: "smoke-rl-6" });
        ok(rl.data?.result?.outcome === "RATE_LIMIT" && !!rl.data.result.retryAt, "rate limit: 6th try within a minute is refused (even a correct one)");
        await ageAttempts();
      }
      if (q.id === "Q07") {
        let st = await A("/api/team/state");
        ok(st.data?.view?.header?.wallet === 30, `hint wallet = 30 after the first 3 questions — got ${st.data?.view?.header?.wallet}`);
        ok(st.data.view.question.hints.length === 3 && st.data.view.question.hints.every((h) => h.text === null), "unbought hint texts are never sent to the phone");
        const low = await A("/api/team/buy-hint", { questionId: q.id, level: "low" });
        ok(low.data?.text === q.hints.find((h) => h.level === "low").text && low.data.view.header.wallet === 25, "buy LOW hint: −5, text matches");
        const again = await B("/api/team/buy-hint", { questionId: q.id, level: "low" });
        ok(again.data?.view?.header?.wallet === 25, "buying the same hint again (other phone) is free");
        const high = await A("/api/team/buy-hint", { questionId: q.id, level: "high" });
        ok(high.data?.view?.header?.wallet === 10, "buy HIGH hint: −15");
        const med = await A("/api/team/buy-hint", { questionId: q.id, level: "medium" });
        ok(med.data?.view?.header?.wallet === 0, "buy MEDIUM hint: −10 → wallet 0");
        st = await A("/api/team/state");
        ok(st.data.view.question.hints.every((h) => h.bought && h.text), "bought hints stay visible on every refresh");
      }
      if (q.id === "Q08") {
        const poor = await A("/api/team/buy-hint", { questionId: q.id, level: "low" });
        ok(poor.status === 409 && poor.data?.code === "INSUFFICIENT", "can't buy with an empty wallet");
      }
      if (q.id === "Q01") {
        const none = await A("/api/team/buy-hint", { questionId: q.id, level: "low" });
        ok(none.status === 409, "first 3 questions have no paid hints");
      }
      const idem = `smoke-${q.id}-ok`;
      const s = await (i === 2 ? B : A)("/api/team/submit", { questionId: q.id, answer: answers[q.id], idemKey: idem });
      if (i === 2 && s.data?.view?.kind === "login") {
        // phone B logs in mid-run
        await B("/api/team/login", { teamId: "T00", password: pw });
        const st = await B("/api/team/state");
        ok(st.data?.view?.question?.id === q.id, "phone B login mid-run shows the same state");
        const s2 = await B("/api/team/submit", { questionId: q.id, answer: answers[q.id], idemKey: idem });
        ok(s2.data?.result?.outcome === "CORRECT", `${q.id}: correct (from phone B)`);
        const late = await A("/api/team/submit", { questionId: q.id, answer: answers[q.id], idemKey: idem + "-a" });
        ok(late.data?.result?.outcome === "ALREADY_SOLVED", "phone A: 'already solved on another phone'");
        continue;
      }
      ok(s.data?.result?.outcome === "CORRECT", `${q.id}: correct${q.id === "Q03" ? " (0 marks after limit)" : ""}`);
      if (q.id === "Q03") ok(s.data.result.marks === 0, "Q03: solved after the attempt limit scores 0");
      const v = s.data?.view;
      if (q.isFinal) {
        ok(v?.kind === "finished" && /^\d{4}$/.test(v.judgeCode ?? ""), "CP-08: TREASURE CLAIMED with 4-digit judge code");
      } else if (qi === cp.questions.length - 1) {
        ok(v?.kind === "clue" && v.clue.riddle === cp.reveal.riddle, `${cp.code}: reveal riddle matches Section 3 exactly`);
        if (cp.reveal.nudge) {
          const h = await A("/api/team/hint", { clue: cp.reveal.clue });
          ok(h.data?.nudge === cp.reveal.nudge, `${cp.code}: nudge matches and is logged`);
        }
        // already-cleared scan repeats the current clue
        if (i === 1) {
          const back = await A("/api/team/scan", { token: tok["CP-01"] });
          ok(back.data?.view?.banner === "ALREADY_CLEARED" && back.data.view.clue?.riddle === cp.reveal.riddle, "old checkpoint → ALREADY CLEARED + current clue");
        }
      } else {
        ok(v?.kind === "question" && v.question.id === cp.questions[qi + 1].id, `${cp.code}: second question follows before any reveal`);
      }
    }
  }

  const { data: marks } = await db.from("score_entries").select("ref, marks").eq("team_id", "T00");
  const clue = marks.filter((m) => m.ref.startsWith("clue:")).reduce((s, m) => s + m.marks, 0);
  ok(marks.filter((m) => m.ref.startsWith("clue:")).length === 15, "15 clue ledger entries");
  ok(clue === 70, `clue marks = 70 (75 minus the 0-scored Q03) — got ${clue}`);
  ok(marks.find((m) => m.ref === "final")?.marks === 15, "final stage +15");

  await db.rpc("reset_team", { p_team_id: "T00" });
  console.log(failures ? `\nsmoke: ${failures} FAILURE(S)` : "\nsmoke: ALL PASSED — T00 reset.");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error("smoke crashed:", e.message);
  process.exit(1);
});
