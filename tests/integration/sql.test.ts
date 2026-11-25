import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { HuntSchema } from "@/lib/content/schema";
import { huntToRows } from "@/lib/content/rows";
import { freshDb } from "../helpers/pg";

// Integration tests of the real Postgres functions (supabase/migrations) on an in-process
// Postgres (PGlite). Uses the committed placeholder content, so it runs in CI.
const hunt = HuntSchema.parse(JSON.parse(readFileSync("content/hunt.example.json", "utf8")));

type J = Record<string, unknown> & { ok?: boolean; reason?: string; outcome?: string; team?: Record<string, unknown> };

async function setup(): Promise<PGlite> {
  const db = await freshDb();
  const tokens = Object.fromEntries(hunt.checkpoints.map((c) => [c.code, `tok${c.order}xxxxx`.slice(0, 8)]));
  const { checkpoints, questions } = huntToRows(hunt, tokens);
  for (const c of checkpoints) {
    await db.query(
      `insert into checkpoints (code, ord, token, location, venue_detail, arrival_credit, arrival_note, reveal) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [c.code, c.ord, c.token, c.location, c.venue_detail, JSON.stringify(c.arrival_credit), c.arrival_note, JSON.stringify(c.reveal)],
    );
  }
  for (const q of questions) {
    await db.query(
      `insert into questions (id, checkpoint_code, position, clue, title, prompt, code, match, accept, near_miss, is_final, wallet_points, hints) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [q.id, q.checkpoint_code, q.position, q.clue, q.title, q.prompt, q.code, q.match, JSON.stringify(q.accept), JSON.stringify(q.near_miss), q.is_final, q.wallet_points, JSON.stringify(q.hints)],
    );
  }
  await db.query(`update event_state set settings = $1, status = 'LIVE', started_at = now() - interval '1 minute' where id = 1`, [
    JSON.stringify(hunt.settings),
  ]);
  await db.query(`insert into teams (id, name, password_hash) values ('T01','Alpha','x'), ('T02','Beta','x')`);
  await db.query(`insert into teams (id, name, password_hash, is_rehearsal) values ('T00','Rehearsal','x', true)`);
  return db;
}

const one = async (db: PGlite, sql: string, params: unknown[] = []): Promise<J> => {
  const r = await db.query<{ r: J }>(sql, params);
  return r.rows[0]!.r;
};
const version = async (db: PGlite, id: string) => (await db.query<{ v: number }>(`select version v from teams where id=$1`, [id])).rows[0]!.v;
const arrive = async (db: PGlite, team: string, cp: string) => one(db, `select arrive($1,$2,$3,'dev') r`, [team, cp, await version(db, team)]);
const attempt = async (db: PGlite, team: string, q: string, correct: boolean, opts: { near?: boolean; idem?: string; v?: number } = {}) =>
  one(db, `select record_attempt($1,$2,$3,$4,$5,'raw','norm','dev',$6) r`, [team, q, opts.v ?? (await version(db, team)), correct, opts.near ?? false, opts.idem ?? null]);
const marks = async (db: PGlite, team: string) =>
  Object.fromEntries((await db.query<{ ref: string; marks: number }>(`select ref, marks from score_entries where team_id=$1 order by ref`, [team])).rows.map((r) => [r.ref, r.marks]));

const qIds = hunt.checkpoints.map((c) => c.questions.map((q) => q.id));

describe("game moves in Postgres", () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await setup();
  });

  it("a full run scores 75 clue marks + 15 final, finishes and issues a judge code", async () => {
    for (let i = 0; i < 8; i++) {
      const cp = hunt.checkpoints[i]!;
      expect((await arrive(db, "T01", cp.code)).ok, cp.code).toBe(true);
      for (const q of qIds[i]!) expect((await attempt(db, "T01", q, true)).outcome, q).toBe("CORRECT");
    }
    const m = await marks(db, "T01");
    const clue = Object.entries(m).filter(([k]) => k.startsWith("clue:")).reduce((s, [, v]) => s + v, 0);
    expect(Object.keys(m).filter((k) => k.startsWith("clue:"))).toHaveLength(15);
    expect(clue).toBe(75);
    expect(m.final).toBe(15);
    const w = (await db.query<{ w: number }>(`select coalesce(sum(points),0)::int w from wallet_entries where team_id='T01'`)).rows[0]!.w;
    expect(w).toBe(30);
    const t = (await db.query<{ status: string; judge_code: string; finished_at: string }>(`select * from teams where id='T01'`)).rows[0]!;
    expect(t.status).toBe("FINISHED");
    expect(t.judge_code).toMatch(/^\d{4}$/);
    expect(t.finished_at).toBeTruthy();
  });

  it("arriving twice does not double-award; arriving at a future checkpoint is refused", async () => {
    await arrive(db, "T01", "CP-01");
    expect((await arrive(db, "T01", "CP-01")).reason).toBe("NOT_NEXT");
    expect((await arrive(db, "T01", "CP-03")).reason).toBe("NOT_NEXT");
  });

  it("CP-04 asks both questions before advancing", async () => {
    for (let i = 0; i < 3; i++) {
      await arrive(db, "T01", hunt.checkpoints[i]!.code);
      for (const q of qIds[i]!) await attempt(db, "T01", q, true);
    }
    await arrive(db, "T01", "CP-04");
    await attempt(db, "T01", qIds[3]![0]!, true);
    let t = (await db.query<{ unlocked_cp: number; q_index: number; arrived: boolean }>(`select * from teams where id='T01'`)).rows[0]!;
    expect(t).toMatchObject({ unlocked_cp: 4, q_index: 1, arrived: true });
    // answering the first question again is the wrong question now
    expect((await attempt(db, "T01", qIds[3]![0]!, true)).reason).toBe("WRONG_QUESTION");
    await attempt(db, "T01", qIds[3]![1]!, true);
    t = (await db.query<{ unlocked_cp: number; q_index: number; arrived: boolean }>(`select * from teams where id='T01'`)).rows[0]!;
    expect(t).toMatchObject({ unlocked_cp: 5, q_index: 0, arrived: false });
  });

  it("4 wrong answers → the clue scores 0 and a cooldown starts", async () => {
    await arrive(db, "T01", "CP-01");
    const q = qIds[0]![0]!;
    const r1 = await attempt(db, "T01", q, false);
    expect(r1).toMatchObject({ outcome: "WRONG", attemptNo: 1, attemptsLeft: 2, cooldownUntil: null });
    await attempt(db, "T01", q, false);
    const r3 = await attempt(db, "T01", q, false);
    expect(r3).toMatchObject({ attemptNo: 3, attemptsLeft: 0, scoring: false, cooldownUntil: null });
    const r4 = await attempt(db, "T01", q, false);
    expect(r4.attemptNo).toBe(4);
    expect(r4.cooldownUntil).toBeTruthy();
    expect((await attempt(db, "T01", q, true)).reason).toBe("COOLDOWN");
    await db.query(`update teams set cooldown_until = now() - interval '1 second' where id='T01'`);
    const ok = await attempt(db, "T01", q, true);
    expect(ok).toMatchObject({ outcome: "CORRECT", marks: 0, attemptNo: 5 });
    expect((await marks(db, "T01"))["clue:01"]).toBe(0);
  });

  it("near-misses never count as attempts", async () => {
    await arrive(db, "T01", "CP-01");
    const q = qIds[0]![0]!;
    for (let i = 0; i < 3; i++) expect((await attempt(db, "T01", q, false, { near: true })).outcome).toBe("NEAR_MISS");
    expect(await attempt(db, "T01", q, true)).toMatchObject({ outcome: "CORRECT", marks: 5, attemptNo: 1 });
  });

  it("two phones submitting at the same version: exactly one wins, no double marks", async () => {
    await arrive(db, "T01", "CP-01");
    const v = await version(db, "T01");
    const q = qIds[0]![0]!;
    const [a, b] = await Promise.all([attempt(db, "T01", q, true, { v, idem: "phone-a" }), attempt(db, "T01", q, true, { v, idem: "phone-b" })]);
    const outcomes = [a.outcome ?? a.reason, b.outcome ?? b.reason].sort();
    expect(outcomes).toEqual(["CONFLICT", "CORRECT"]);
    expect(await marks(db, "T01")).toEqual({ "clue:01": 5 });
  });

  it("retrying with the same idempotency key replays the result instead of counting again", async () => {
    await arrive(db, "T01", "CP-01");
    const q = qIds[0]![0]!;
    const v = await version(db, "T01");
    const first = await attempt(db, "T01", q, false, { v, idem: "k1" });
    const again = await attempt(db, "T01", q, false, { v, idem: "k1" });
    expect(first.attemptNo).toBe(1);
    expect(again).toMatchObject({ replay: true, attemptNo: 1 });
    const n = (await db.query<{ n: number }>(`select count(*)::int n from attempts where team_id='T01'`)).rows[0]!.n;
    expect(n).toBe(1);
  });

  it("nothing moves when the event is not LIVE — except for rehearsal team T00", async () => {
    await db.query(`update event_state set status='PAUSED'`);
    expect((await arrive(db, "T01", "CP-01")).reason).toBe("PAUSED");
    expect((await arrive(db, "T00", "CP-01")).ok).toBe(true);
    await db.query(`update event_state set status='DRAFT'`);
    expect((await arrive(db, "T01", "CP-01")).reason).toBe("NOT_STARTED");
    await db.query(`update event_state set status='LIVE', started_at = now() + interval '1 hour'`);
    expect((await arrive(db, "T01", "CP-01")).reason).toBe("NOT_STARTED");
    await db.query(`update event_state set status='ENDED'`);
    expect((await arrive(db, "T01", "CP-01")).reason).toBe("TIMES_UP");
  });

  it("a disqualified team cannot arrive or answer", async () => {
    await arrive(db, "T01", "CP-01");
    await db.query(`update teams set status='DISQUALIFIED' where id='T01'`);
    expect((await attempt(db, "T01", qIds[0]![0]!, true)).reason).toBe("NOT_ACTIVE");
  });

  it("submitting for a question at a checkpoint you have not arrived at is refused", async () => {
    expect((await attempt(db, "T01", qIds[0]![0]!, true)).reason).toBe("NOT_ARRIVED");
    await arrive(db, "T01", "CP-01");
    expect((await attempt(db, "T01", qIds[1]![0]!, true)).reason).toBe("WRONG_QUESTION");
  });

  it("stale version is rejected as CONFLICT", async () => {
    await arrive(db, "T01", "CP-01");
    expect((await attempt(db, "T01", qIds[0]![0]!, true, { v: 0 })).reason).toBe("CONFLICT");
  });

  it("login throttle allows 5 per window then blocks", async () => {
    const res: boolean[] = [];
    for (let i = 0; i < 7; i++) res.push((await db.query<{ r: boolean }>(`select throttle_hit('ip:T01', 5, 60) r`)).rows[0]!.r);
    expect(res).toEqual([true, true, true, true, true, false, false]);
    await db.query(`update login_throttle set window_start = now() - interval '2 minutes'`);
    expect((await db.query<{ r: boolean }>(`select throttle_hit('ip:T01', 5, 60) r`)).rows[0]!.r).toBe(true);
  });

  it("hint use is logged once per clue", async () => {
    await one(db, `select use_hint('T01', 2) r`);
    const second = await one(db, `select use_hint('T01', 2) r`);
    expect(second.first).toBe(false);
  });

  it("reset_team wipes progress and ledger; team_context reports state", async () => {
    await arrive(db, "T01", "CP-01");
    await attempt(db, "T01", qIds[0]![0]!, true);
    await db.query(`select reset_team('T01')`);
    expect(await marks(db, "T01")).toEqual({});
    const ctx = await one(db, `select team_context('T01') r`);
    expect(ctx.team).toMatchObject({ unlocked_cp: 1, arrived: false, status: "ACTIVE" });
    expect(ctx.team).not.toHaveProperty("password_hash");
    expect((ctx.checkpoints as unknown[]).length).toBe(8);
  });

  it("admin_snapshot aggregates marks per team", async () => {
    await arrive(db, "T01", "CP-01");
    await attempt(db, "T01", qIds[0]![0]!, true);
    await arrive(db, "T01", "CP-02");
    const snap = await one(db, `select admin_snapshot() r`);
    const t1 = (snap.teams as J[]).find((t) => t.id === "T01")!;
    expect(t1.clueMarks).toBe(10);
    expect(t1).not.toHaveProperty("password_hash");
  });
});

describe("hint wallet + answer rate limit", () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await setup();
  });
  const wallet = async (team: string) =>
    (await db.query<{ w: number }>(`select coalesce(sum(points),0)::int w from wallet_entries where team_id=$1`, [team])).rows[0]!.w;
  const buy = (team: string, q: string, level: string) => one(db, `select buy_hint($1,$2,$3) r`, [team, q, level]);
  async function reachCp4(team: string) {
    for (let i = 0; i < 3; i++) {
      await arrive(db, team, hunt.checkpoints[i]!.code);
      for (const q of qIds[i]!) await attempt(db, team, q, true);
    }
    await arrive(db, team, "CP-04");
  }

  it("the first 3 questions each add 10 to the wallet (once); later ones add nothing", async () => {
    await arrive(db, "T01", "CP-01");
    await attempt(db, "T01", qIds[0]![0]!, true);
    expect(await wallet("T01")).toBe(10);
    await reachCp4("T02");
    expect(await wallet("T02")).toBe(30);
    await attempt(db, "T02", qIds[3]![0]!, true);
    expect(await wallet("T02")).toBe(30);
  });

  it("hints cost 5 / 10 / 15, are paid once, and the wallet never goes negative", async () => {
    await reachCp4("T01");
    const q = qIds[3]![0]!;
    const low = await buy("T01", q, "low");
    expect(low).toMatchObject({ ok: true, already: false, cost: 5, balance: 25 });
    expect(String(low.text)).toContain("Placeholder low hint");
    expect(await buy("T01", q, "low")).toMatchObject({ ok: true, already: true, balance: 25 });
    expect(await buy("T01", q, "high")).toMatchObject({ ok: true, cost: 15, balance: 10 });
    expect(await buy("T01", q, "medium")).toMatchObject({ ok: true, cost: 10, balance: 0 });
    await attempt(db, "T01", q, true);
    expect(await buy("T01", qIds[3]![1]!, "low")).toMatchObject({ ok: false, reason: "INSUFFICIENT", balance: 0, cost: 5 });
    expect(await wallet("T01")).toBe(0);
  });

  it("two phones buying at the same time never spend more than the balance", async () => {
    await reachCp4("T01");
    await db.query(`delete from wallet_entries where team_id='T01' and ref <> 'earn:Q01'`); // balance 10
    const q = qIds[3]![0]!;
    const [a, b] = await Promise.all([buy("T01", q, "medium"), buy("T01", q, "high")]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(await wallet("T01")).toBeGreaterThanOrEqual(0);
  });

  it("hints are only for the current question, and the first 3 questions have none", async () => {
    await arrive(db, "T01", "CP-01");
    expect((await buy("T01", qIds[0]![0]!, "low")).reason).toBe("NO_HINT");
    expect((await buy("T01", qIds[3]![0]!, "low")).reason).toBe("NOT_CURRENT");
    expect((await buy("T01", qIds[0]![0]!, "ultra")).reason).toBe("NO_HINT");
  });

  it("rate limit: the 6th try within a minute is refused; correct answers never count", async () => {
    await db.query(`update event_state set settings = settings || '{"cooldownSecondsAfterLimit":0}'`);
    await arrive(db, "T01", "CP-01");
    const q = qIds[0]![0]!;
    for (let i = 0; i < 4; i++) expect((await attempt(db, "T01", q, false)).outcome).toBe("WRONG");
    expect((await attempt(db, "T01", q, false, { near: true })).outcome).toBe("NEAR_MISS");
    const blocked = await attempt(db, "T01", q, true);
    expect(blocked.reason).toBe("RATE_LIMIT");
    expect(blocked.retryAt).toBeTruthy();
    await db.query(`update attempts set at = at - interval '2 minutes' where team_id='T01'`);
    expect((await attempt(db, "T01", q, true)).outcome).toBe("CORRECT");
    await db.query(`update event_state set settings = settings || '{"answerRateLimit":1}'`);
    await arrive(db, "T01", "CP-02");
    expect((await attempt(db, "T01", qIds[1]![0]!, true)).outcome).toBe("CORRECT");
  });

  it("reset_team clears the wallet", async () => {
    await arrive(db, "T01", "CP-01");
    await attempt(db, "T01", qIds[0]![0]!, true);
    await db.query(`select reset_team('T01')`);
    expect(await wallet("T01")).toBe(0);
  });
});

describe("RLS lockdown (anon / authenticated roles)", () => {
  it("cannot select from any table or call any function", async () => {
    const db = await setup();
    const tables = ["event_state", "checkpoints", "questions", "teams", "arrivals", "attempts", "score_entries", "scan_logs", "hint_uses", "audit_logs", "login_throttle", "wallet_entries"];
    for (const role of ["anon", "authenticated"]) {
      await db.query(`set role ${role}`);
      for (const t of tables) await expect(db.query(`select * from public.${t}`), `${role} ${t}`).rejects.toThrow(/permission denied/);
      await expect(db.query(`select public.team_context('T01')`)).rejects.toThrow(/permission denied/);
      await expect(db.query(`select public.arrive('T01','CP-01',0)`)).rejects.toThrow(/permission denied/);
      await expect(db.query(`select public.buy_hint('T01','Q07','low')`)).rejects.toThrow(/permission denied/);
      await db.query(`reset role`);
    }
  });
});
