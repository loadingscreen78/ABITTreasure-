import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { matchAnswer, type MatchMode } from "@/lib/game/match";
import { clearedCount, decideScan } from "@/lib/game/progress";
import { withDefaults, type Settings } from "@/lib/game/scoring";
import type { Banner, Gate, SubmitResult, TeamHeader, TeamView } from "@/lib/types";
import { rpc, safe } from "./db";

// ---------- context from team_context() ----------

export interface TeamRow {
  id: string;
  name: string;
  members: string[];
  status: "ACTIVE" | "FINISHED" | "DISQUALIFIED";
  unlocked_cp: number;
  arrived: boolean;
  q_index: number;
  cooldown_until: string | null;
  started_at: string | null;
  finished_at: string | null;
  judge_code: string | null;
  is_rehearsal: boolean;
  version: number;
  session_version: number;
}

interface CpRow {
  code: string;
  order: number;
  token: string;
  location: string;
  arrivalCredit: { clue: number; title: string; answer: string } | null;
  arrivalNote: string | null;
  reveal: { clue: number | null; title: string; riddle: string; nudge: string | null; leadsTo: string } | null;
}

interface QRow {
  id: string;
  checkpointCode: string;
  position: number;
  clue: number;
  title: string;
  prompt: string;
  code: string | null;
  match: MatchMode;
  accept: string[];
  nearMiss: Record<string, string>;
  isFinal: boolean;
  walletPoints?: number;
  hints?: { level: "low" | "medium" | "high"; text: string }[];
}

export interface TeamCtx {
  team: TeamRow;
  sessionVersion: number;
  event: { status: "DRAFT" | "LIVE" | "PAUSED" | "ENDED"; startedAt: string | null; endsAt: string | null; settings: Partial<Settings> };
  checkpoints: CpRow[];
  questions: QRow[];
  wrongCount: number;
  solved: string[];
  scores: Record<string, number>;
  hints: number[];
  wallet?: number;
  purchases?: string[];
  now: string;
}

export async function loadCtx(db: SupabaseClient, teamId: string) {
  return rpc<TeamCtx | null>(db, "team_context", { p_team_id: teamId });
}

export const settingsOf = (ctx: TeamCtx) => withDefaults(ctx.event.settings);

// ---------- pure view building ----------

export function gateFor(ctx: TeamCtx, nowMs = Date.now()): { gate: Gate | null; startsAt: string | null } {
  if (ctx.team.status === "DISQUALIFIED") return { gate: "DISQUALIFIED", startsAt: null };
  if (ctx.team.is_rehearsal || ctx.team.status === "FINISHED") return { gate: null, startsAt: null };
  const e = ctx.event;
  if (e.status === "DRAFT") return { gate: "NOT_STARTED", startsAt: null };
  if (e.status === "PAUSED") return { gate: "PAUSED", startsAt: null };
  if (e.status === "ENDED") return { gate: "TIMES_UP", startsAt: null };
  if (!e.startedAt || new Date(e.startedAt).getTime() > nowMs) return { gate: "NOT_STARTED", startsAt: e.startedAt };
  if (e.endsAt && nowMs > new Date(e.endsAt).getTime()) return { gate: "TIMES_UP", startsAt: null };
  return { gate: null, startsAt: null };
}

const startOf = (ctx: TeamCtx) => (ctx.team.is_rehearsal ? ctx.team.started_at : ctx.event.startedAt);

function header(ctx: TeamCtx): TeamHeader {
  const t = ctx.team;
  return {
    id: t.id,
    name: t.name,
    cleared: clearedCount({ unlockedCp: t.unlocked_cp, arrived: t.arrived, qIndex: t.q_index, status: t.status }, ctx.checkpoints.length || 8),
    current: Math.min(t.unlocked_cp, ctx.checkpoints.length || 8),
    total: ctx.checkpoints.length || 8,
    startedAt: startOf(ctx),
    serverNow: new Date().toISOString(),
    rehearsal: t.is_rehearsal,
    wallet: Number(ctx.wallet ?? 0),
  };
}

export function currentQuestion(ctx: TeamCtx): QRow | null {
  const cp = ctx.checkpoints.find((c) => c.order === ctx.team.unlocked_cp);
  if (!cp) return null;
  const qs = ctx.questions.filter((q) => q.checkpointCode === cp.code).sort((a, b) => a.position - b.position);
  return qs[ctx.team.q_index] ?? null;
}

export function buildView(ctx: TeamCtx, banner: Banner = null): TeamView {
  const t = ctx.team;
  const h = header(ctx);
  if (t.status === "FINISHED") {
    const start = startOf(ctx);
    const elapsedMs = start && t.finished_at ? new Date(t.finished_at).getTime() - new Date(start).getTime() : null;
    const finalQ = ctx.questions.find((q) => q.isFinal);
    const phrase = finalQ?.accept[0]?.toUpperCase() ?? null;
    return { kind: "finished", header: h, finishedAt: t.finished_at, elapsedMs, judgeCode: t.judge_code, phrase };
  }
  const g = gateFor(ctx);
  if (g.gate) return { kind: "gate", gate: g.gate, header: h, startsAt: g.startsAt };

  const s = settingsOf(ctx);
  const cp = ctx.checkpoints.find((c) => c.order === t.unlocked_cp);
  if (!cp) return { kind: "error", message: "Checkpoint data missing. Please find a volunteer." };

  if (t.arrived) {
    const qs = ctx.questions.filter((q) => q.checkpointCode === cp.code).sort((a, b) => a.position - b.position);
    const q = qs[t.q_index];
    if (!q) return { kind: "error", message: "Question data missing. Please find a volunteer." };
    const credit = cp.arrivalCredit;
    return {
      kind: "question",
      header: h,
      banner,
      cp: {
        order: cp.order,
        arrival: credit
          ? { title: credit.title, answer: credit.answer, marks: ctx.scores[`clue:${String(credit.clue).padStart(2, "0")}`] ?? null }
          : null,
        note: cp.arrivalNote,
      },
      question: {
        id: q.id,
        clue: q.clue,
        title: q.title,
        prompt: q.prompt,
        code: q.code,
        index: t.q_index,
        total: qs.length,
        wrongCount: ctx.wrongCount,
        fullWithin: s.fullMarksWithinAttempts,
        cooldownUntil: t.cooldown_until && new Date(t.cooldown_until).getTime() > Date.now() ? t.cooldown_until : null,
        cooldownSeconds: s.cooldownSecondsAfterLimit,
        isFinal: q.isFinal,
        hints: (q.hints ?? []).map((hh) => {
          const bought = (ctx.purchases ?? []).includes(`hint:${q.id}:${hh.level}`);
          return { level: hh.level, cost: s.hintCosts[hh.level] ?? 0, bought, text: bought ? hh.text : null };
        }),
      },
    };
  }

  // Not yet at the next checkpoint: show the riddle revealed by the previous one.
  if (t.unlocked_cp === 1) return { kind: "start", header: h, banner };
  const prev = ctx.checkpoints.find((c) => c.order === t.unlocked_cp - 1);
  const r = prev?.reveal;
  if (!r) return { kind: "error", message: "Clue data missing. Please find a volunteer." };
  const used = r.clue !== null && ctx.hints.includes(r.clue);
  return {
    kind: "clue",
    header: h,
    banner,
    clue: { clue: r.clue, title: r.title, riddle: r.riddle, nextOrder: t.unlocked_cp, hasNudge: !!r.nudge, nudge: used ? r.nudge : null },
  };
}

// ---------- actions ----------

type Log = (row: { team_id: string | null; cp_code: string | null; result: string; device_id: string | null }) => void;

export async function scan(
  db: SupabaseClient,
  ctx0: TeamCtx,
  token: string,
  device: string | null,
  log: Log,
): Promise<TeamView> {
  let ctx = ctx0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const cp = ctx.checkpoints.find((c) => c.token === token);
    if (!cp) {
      log({ team_id: ctx.team.id, cp_code: null, result: "INVALID_TOKEN", device_id: device });
      return { kind: "invalid" };
    }
    const view = buildView(ctx);
    if (view.kind === "finished" || view.kind === "gate" || view.kind === "error") {
      log({ team_id: ctx.team.id, cp_code: cp.code, result: view.kind === "gate" ? `GATE_${view.gate}` : view.kind.toUpperCase(), device_id: device });
      return view;
    }
    const t = ctx.team;
    const d = decideScan({ unlockedCp: t.unlocked_cp, arrived: t.arrived, qIndex: t.q_index, status: t.status }, cp.order);
    if (d === "WRONG_TURN" || d === "ALREADY_CLEARED") {
      log({ team_id: t.id, cp_code: cp.code, result: d, device_id: device });
      return buildView(ctx, d);
    }
    if (d === "REPEAT" || d === "FINISHED") {
      log({ team_id: t.id, cp_code: cp.code, result: "REPEAT", device_id: device });
      return view;
    }
    // ARRIVE — POST-only, atomic, version-checked.
    const r = await rpc<{ ok: boolean; reason?: string; team?: TeamRow }>(db, "arrive", {
      p_team_id: t.id,
      p_cp_code: cp.code,
      p_expected_version: t.version,
      p_device_id: device,
    });
    if (r.error !== null) return { kind: "error", message: "Weak signal — please try again." };
    if (r.data.ok && r.data.team) {
      log({ team_id: t.id, cp_code: cp.code, result: "ARRIVED", device_id: device });
      const credit = cp.arrivalCredit;
      const scores = { ...ctx.scores };
      if (credit) scores[`clue:${String(credit.clue).padStart(2, "0")}`] ??= settingsOf(ctx).marksPerClue;
      return buildView({ ...ctx, team: r.data.team, scores, wrongCount: 0 }, "ARRIVED");
    }
    // Another phone moved first (CONFLICT / NOT_NEXT): re-read and decide again.
    const fresh = await loadCtx(db, t.id);
    if (fresh.error || !fresh.data) return { kind: "error", message: "Weak signal — please try again." };
    ctx = fresh.data;
  }
  return buildView(ctx);
}

export async function submit(
  db: SupabaseClient,
  ctx0: TeamCtx,
  input: { questionId: string; answer: string; idemKey: string | null },
  device: string | null,
): Promise<{ result: SubmitResult; view: TeamView }> {
  let ctx = ctx0;
  const answer = input.answer.slice(0, 200);
  if (!answer.trim()) return { result: { outcome: "EMPTY" }, view: buildView(ctx) };

  for (let attempt = 0; attempt < 3; attempt++) {
    const view = buildView(ctx);
    if (view.kind !== "question" && view.kind !== "clue" && view.kind !== "start") {
      return { result: { outcome: "BLOCKED" }, view };
    }
    const q = ctx.questions.find((x) => x.id === input.questionId);
    if (!q) return { result: { outcome: "STALE" }, view };
    const s = settingsOf(ctx);
    const m = matchAnswer(q, answer, s.secretWord);
    const r = await rpc<Record<string, unknown> & { ok: boolean; reason?: string; outcome?: string; team?: TeamRow }>(db, "record_attempt", {
      p_team_id: ctx.team.id,
      p_question_id: q.id,
      p_expected_version: ctx.team.version,
      p_correct: m.correct,
      p_near_miss: !m.correct && m.nearMiss !== null,
      p_raw: answer,
      p_normalized: m.normalized,
      p_device_id: device,
      p_idem_key: input.idemKey,
    });
    if (r.error !== null) throw new Error("record_attempt failed");
    const d = r.data;
    if (d.ok && d.team) {
      const team = d.team;
      if (d.outcome === "CORRECT") {
        const marks = Number(d.marks ?? 0);
        const scores = { ...ctx.scores, [`clue:${String(q.clue).padStart(2, "0")}`]: marks };
        const next = { ...ctx, team, scores, solved: [...ctx.solved, q.id], wrongCount: 0, wallet: Number(ctx.wallet ?? 0) + Number(d.replay ? 0 : (d.walletEarned ?? 0)) };
        return { result: { outcome: "CORRECT", marks, attemptNo: Number(d.attemptNo) }, view: buildView(next) };
      }
      if (d.outcome === "NEAR_MISS") {
        return { result: { outcome: "NEAR_MISS", message: m.nearMiss ?? "Close — try again." }, view: buildView({ ...ctx, team }) };
      }
      // WRONG
      const next = { ...ctx, team, wrongCount: Number(d.attemptNo ?? ctx.wrongCount + 1) };
      return {
        result: {
          outcome: "WRONG",
          attemptNo: Number(d.attemptNo),
          attemptsLeft: Number(d.attemptsLeft ?? 0),
          scoring: Boolean(d.scoring),
          cooldownUntil: (d.cooldownUntil as string | null) ?? null,
        },
        view: buildView(next),
      };
    }
    if (d.reason === "RATE_LIMIT") {
      return { result: { outcome: "RATE_LIMIT", retryAt: (d.retryAt as string) ?? null }, view };
    }
    if (d.reason === "COOLDOWN") {
      return { result: { outcome: "COOLDOWN", cooldownUntil: d.cooldownUntil as string }, view };
    }
    if (d.reason === "CONFLICT" || d.reason === "WRONG_QUESTION" || d.reason === "NOT_ARRIVED") {
      const fresh = await loadCtx(db, ctx.team.id);
      if (fresh.error || !fresh.data) throw new Error("reload failed");
      ctx = fresh.data;
      if (ctx.solved.includes(q.id)) {
        return { result: { outcome: "ALREADY_SOLVED" }, view: buildView(ctx, "ANOTHER_PHONE") };
      }
      if (d.reason !== "CONFLICT") return { result: { outcome: "STALE" }, view: buildView(ctx) };
      continue;
    }
    return { result: { outcome: "BLOCKED" }, view: buildView(ctx) };
  }
  return { result: { outcome: "STALE" }, view: buildView(ctx) };
}

/** "Need a nudge?" — only for the riddle the team is currently looking for. */
export async function hint(db: SupabaseClient, ctx: TeamCtx, clue: number): Promise<string | null> {
  const v = buildView(ctx);
  if (v.kind !== "clue" || v.clue.clue !== clue || !v.clue.hasNudge) return null;
  const prev = ctx.checkpoints.find((c) => c.order === ctx.team.unlocked_cp - 1);
  await rpc(db, "use_hint", { p_team_id: ctx.team.id, p_clue: clue });
  return prev?.reveal?.nudge ?? null;
}

/** Buy a paid hint for the current question from the team's wallet (atomic in buy_hint()). */
export async function buyHint(
  db: SupabaseClient,
  ctx: TeamCtx,
  questionId: string,
  level: "low" | "medium" | "high",
): Promise<{ ok: true; view: TeamView; text: string } | { ok: false; code: string; message: string; view: TeamView }> {
  const r = await rpc<{ ok: boolean; reason?: string; text?: string; balance?: number; cost?: number }>(db, "buy_hint", {
    p_team_id: ctx.team.id,
    p_question_id: questionId,
    p_level: level,
  });
  if (r.error !== null) return { ok: false, code: "NETWORK", message: "Weak signal — try again.", view: buildView(ctx) };
  const d = r.data;
  if (d.ok && d.text) {
    const purchases = [...new Set([...(ctx.purchases ?? []), `hint:${questionId}:${level}`])];
    return { ok: true, text: d.text, view: buildView({ ...ctx, wallet: Number(d.balance ?? 0), purchases }) };
  }
  if (d.reason === "INSUFFICIENT")
    return { ok: false, code: "INSUFFICIENT", message: `Not enough hint points — this hint costs ${d.cost}, you have ${d.balance}.`, view: buildView(ctx) };
  if (d.reason === "NOT_CURRENT") return { ok: false, code: "NOT_CURRENT", message: "That question is already behind you.", view: buildView(ctx) };
  return { ok: false, code: d.reason ?? "FAILED", message: "No hint available for this question.", view: buildView(ctx) };
}

export async function cpOrderForToken(db: SupabaseClient, token: string): Promise<number | null> {
  const r = await safe(db.from("checkpoints").select("ord").eq("token", token).maybeSingle(), "cp by token");
  if (r.error || !r.data) return null;
  return (r.data as { ord: number }).ord;
}
