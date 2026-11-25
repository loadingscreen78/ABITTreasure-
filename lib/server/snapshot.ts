import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeStandings, withDefaults, type Settings, type Standing } from "@/lib/game/scoring";
import { rpc } from "./db";

export interface SnapTeam {
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
  final_confirmed: boolean;
  final_revoked: boolean;
  teamwork: number | null;
  judge_code: string | null;
  is_rehearsal: boolean;
  version: number;
  last_activity_at: string | null;
  session_version: number;
  clueMarks: number;
  finalMarks: number;
  adjustMarks: number;
  scores: Record<string, number>;
  wrongCurrent: number;
  wrongTotal: number;
  hintsUsed: number;
  wallet: number;
  hintsBought: number;
  outOfOrder: number;
  devices: number;
  arrivals: Record<string, string>;
}

export interface RawSnapshot {
  now: string;
  event: {
    status: "DRAFT" | "LIVE" | "PAUSED" | "ENDED";
    started_at: string | null;
    ends_at: string | null;
    settings: Partial<Settings>;
    event: Record<string, unknown>;
    results_revealed: boolean;
  };
  checkpoints: { code: string; order: number; token: string; location: string; venueDetail: string | null }[];
  teams: SnapTeam[];
}

export interface Snapshot {
  now: string;
  event: RawSnapshot["event"] & { settings: Settings };
  checkpoints: RawSnapshot["checkpoints"];
  teams: (SnapTeam & { elapsedMs: number | null; cleared: number; flags: string[] })[];
  standings: Standing[];
  stations: { code: string; order: number; cleared: number; heading: number; atNow: number; medianMs: number | null; crowded: boolean }[];
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
};

export async function loadSnapshot(db: SupabaseClient): Promise<Snapshot | null> {
  const r = await rpc<RawSnapshot>(db, "admin_snapshot");
  if (r.error || !r.data) return null;
  const raw = r.data;
  const settings = withDefaults(raw.event.settings);
  const nowMs = new Date(raw.now).getTime();
  const total = raw.checkpoints.length || 8;

  const teams = raw.teams.map((t) => {
    const start = t.is_rehearsal ? t.started_at : raw.event.started_at;
    const elapsedMs = start && t.finished_at ? new Date(t.finished_at).getTime() - new Date(start).getTime() : null;
    const cleared = t.status === "FINISHED" ? total : Math.max(0, t.unlocked_cp - 1);
    const flags: string[] = [];
    if (t.outOfOrder > 0) flags.push(`OUT-OF-ORDER ×${t.outOfOrder}`);
    if (t.wrongCurrent >= 4) flags.push(`${t.wrongCurrent} WRONG`);
    if (t.status === "ACTIVE" && t.last_activity_at && nowMs - new Date(t.last_activity_at).getTime() > 5 * 60_000) flags.push("INACTIVE >5m");
    return { ...t, elapsedMs, cleared, flags };
  });

  const standings = computeStandings(
    teams.map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      isRehearsal: t.is_rehearsal,
      clueMarks: t.clueMarks,
      finalMarks: t.finalMarks,
      adjustMarks: t.adjustMarks,
      finalRevoked: t.final_revoked,
      teamwork: t.teamwork,
      elapsedMs: t.elapsedMs,
    })),
    settings,
  );

  const players = teams.filter((t) => !t.is_rehearsal && t.status !== "DISQUALIFIED");
  const stations = raw.checkpoints.map((c) => {
    const next = raw.checkpoints.find((x) => x.order === c.order + 1);
    const durations: number[] = [];
    for (const t of players) {
      const a = t.arrivals[c.code];
      if (!a) continue;
      const leave = next ? t.arrivals[next.code] : t.finished_at;
      if (leave) durations.push(new Date(leave).getTime() - new Date(a).getTime());
    }
    const cleared = players.filter((t) => t.status === "FINISHED" || t.unlocked_cp > c.order).length;
    const heading = players.filter((t) => t.status === "ACTIVE" && t.unlocked_cp === c.order && !t.arrived).length;
    const atNow = players.filter((t) => t.status === "ACTIVE" && t.unlocked_cp === c.order && t.arrived).length;
    return { code: c.code, order: c.order, cleared, heading, atNow, medianMs: median(durations), crowded: heading + atNow >= 5 };
  });

  return { now: raw.now, event: { ...raw.event, settings }, checkpoints: raw.checkpoints, teams, standings, stations };
}
