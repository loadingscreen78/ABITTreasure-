import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TIE_BREAKERS } from "@/lib/content/schema";
import { safe } from "./db";
import type { Snapshot } from "./snapshot";

interface QRow {
  id: string;
  checkpoint_code: string;
  position: number;
  clue: number;
  title: string;
  prompt: string;
  code: string | null;
  match: string;
  accept: string[];
  hints?: { level: string; text: string }[];
  wallet_points?: number;
}
interface CRow {
  code: string;
  ord: number;
  location: string;
  venue_detail: string | null;
  arrival_credit: { clue: number; title: string; answer: string } | null;
  reveal: { clue: number | null; title: string; riddle: string; nudge: string | null } | null;
}

async function content(db: SupabaseClient) {
  const [c, q] = await Promise.all([
    safe(db.from("checkpoints").select("code, ord, location, venue_detail, arrival_credit, reveal").order("ord"), "content cps"),
    safe(db.from("questions").select("id, checkpoint_code, position, clue, title, prompt, code, match, accept, hints, wallet_points").order("clue"), "content qs"),
  ]);
  if (c.error || q.error) return null;
  return { cps: c.data as CRow[], qs: q.data as QRow[] };
}

/** Answer key for organisers (admin / judge only). */
export async function answerKey(db: SupabaseClient, secretWord: string) {
  const ct = await content(db);
  if (!ct) return null;
  const rows: { clue: number; kind: "question" | "location"; title: string; answer: string; cp: string; where: string; hints?: string[]; wallet?: number }[] = [];
  for (const cp of ct.cps) {
    if (cp.arrival_credit)
      rows.push({ clue: cp.arrival_credit.clue, kind: "location", title: cp.arrival_credit.title, answer: cp.arrival_credit.answer, cp: cp.code, where: cp.location });
    for (const q of ct.qs.filter((x) => x.checkpoint_code === cp.code)) {
      const answer = q.match === "secret-word" ? secretWord : q.accept.map((a) => (q.match === "html-tag" && a.length === 1 ? `<${a}>` : a.toUpperCase())).slice(0, 3).join(" / ");
      rows.push({ clue: q.clue, kind: "question", title: q.title, answer, cp: cp.code, where: cp.location, hints: (q.hints ?? []).map((h) => `${h.level.toUpperCase()}: ${h.text}`), wallet: q.wallet_points ?? 0 });
    }
  }
  rows.sort((a, b) => a.clue - b.clue);
  const route = ct.cps.map((c) => ({ code: c.code, order: c.ord, location: c.location, venueDetail: c.venue_detail, riddle: c.reveal?.riddle ?? null, nudge: c.reveal?.nudge ?? null }));
  return { rows, route, tieBreakers: TIE_BREAKERS };
}

/** Mirrors the organisers' paper answer sheet for one team. */
export async function teamSheet(db: SupabaseClient, snap: Snapshot, teamId: string) {
  const t = snap.teams.find((x) => x.id === teamId);
  const s = snap.standings.find((x) => x.id === teamId);
  if (!t) return null;
  const ct = await content(db);
  const at = await safe(
    db.from("attempts").select("question_id, raw, correct").eq("team_id", teamId).eq("correct", true),
    "sheet attempts",
  );
  if (!ct || at.error) return null;
  const accepted = new Map((at.data as { question_id: string; raw: string }[]).map((a) => [a.question_id, a.raw]));
  const rows = Array.from({ length: 15 }, (_, i) => {
    const clue = i + 1;
    const ref = `clue:${String(clue).padStart(2, "0")}`;
    const q = ct.qs.find((x) => x.clue === clue);
    const cp = ct.cps.find((c) => c.arrival_credit?.clue === clue);
    const answer = q ? (accepted.get(q.id) ?? "") : cp && t.arrivals[cp.code] ? `${cp.arrival_credit!.answer} (arrived)` : "";
    return { clue, answer, marks: t.scores[ref] ?? null };
  });
  const final = ct.qs.find((x) => x.clue === 15);
  return {
    team: { id: t.id, name: t.name, members: t.members, status: t.status },
    rows,
    finalPhrase: final ? (accepted.get(final.id) ?? "") : "",
    startedAt: t.is_rehearsal ? t.started_at : snap.event.started_at,
    finishedAt: t.finished_at,
    elapsedMs: t.elapsedMs,
    totals: s
      ? { clues: s.clues, final: s.final, teamwork: s.teamworkMarks, timeBonus: s.timeBonus, adjust: s.adjustMarks, total: s.total, rank: s.rank }
      : null,
  };
}
