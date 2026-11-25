/**
 * Scoring (Section 5): 75 clue marks + 15 final + 5 teamwork + 5 time bonus = 100.
 * Pure functions; inputs come from the admin_snapshot() aggregate.
 */

export interface Settings {
  secretWord: string;
  marksPerClue: number;
  fullMarksWithinAttempts: number;
  cooldownSecondsAfterLimit: number;
  finalStageMarks: number;
  teamworkMax: number;
  timeBonus: number[];
  timeBonusMode: "tiered" | "tiebreak";
  hintPenalty: number;
  loginEveryScan: boolean;
  showScoresOnBoard: boolean;
  timeLimitMinutes: number;
  hintCosts: { low: number; medium: number; high: number };
  answerRateLimit: number;
  answerRateWindowSeconds: number;
  registrationOpen: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  secretWord: "",
  marksPerClue: 5,
  fullMarksWithinAttempts: 3,
  cooldownSecondsAfterLimit: 15,
  finalStageMarks: 15,
  teamworkMax: 5,
  timeBonus: [5, 3, 1],
  timeBonusMode: "tiered",
  hintPenalty: 0,
  loginEveryScan: false,
  showScoresOnBoard: false,
  timeLimitMinutes: 0,
  hintCosts: { low: 5, medium: 10, high: 15 },
  answerRateLimit: 5,
  answerRateWindowSeconds: 60,
  registrationOpen: true,
};

export function withDefaults(s: Partial<Settings> | null | undefined): Settings {
  return { ...DEFAULT_SETTINGS, ...(s ?? {}) } as Settings;
}

export const CLUE_COUNT = 15;
export const MAX_CLUE_MARKS = 75;
export const MAX_TIME_BONUS = 5;

export interface TeamScoreInput {
  id: string;
  name: string;
  status: "ACTIVE" | "FINISHED" | "DISQUALIFIED";
  isRehearsal: boolean;
  clueMarks: number;
  finalMarks: number;
  adjustMarks: number;
  finalRevoked: boolean;
  teamwork: number | null;
  /** Elapsed ms from the global start to solving Q15; null if not finished. */
  elapsedMs: number | null;
}

export interface Standing extends TeamScoreInput {
  clues: number;
  final: number;
  teamworkMarks: number;
  timeBonus: number;
  total: number;
  rank: number | null;
  eligibleForBonus: boolean;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Marks for a clue question given which attempt solved it (1-based). */
export function marksForAttempt(attemptNo: number, s: Pick<Settings, "marksPerClue" | "fullMarksWithinAttempts">) {
  return attemptNo >= 1 && attemptNo <= s.fullMarksWithinAttempts ? s.marksPerClue : 0;
}

/** Whether a wrong attempt with this number triggers the cooldown lock. */
export function cooldownAfterWrong(attemptNo: number, s: Pick<Settings, "fullMarksWithinAttempts">) {
  return attemptNo > s.fullMarksWithinAttempts;
}

/**
 * Time bonus among eligible teams (75/75 clues + final 15), ranked by elapsed time.
 * Ties share a tier (competition ranking 1,1,3). Never more than 5.
 */
export function timeBonuses(
  teams: Pick<TeamScoreInput, "id" | "elapsedMs">[],
  eligible: (id: string) => boolean,
  s: Pick<Settings, "timeBonus" | "timeBonusMode">,
): Map<string, number> {
  const out = new Map<string, number>();
  if (s.timeBonusMode !== "tiered") return out;
  const ranked = teams
    .filter((t) => eligible(t.id) && t.elapsedMs !== null)
    .sort((a, b) => (a.elapsedMs ?? 0) - (b.elapsedMs ?? 0));
  let i = 0;
  while (i < ranked.length) {
    let j = i;
    while (j + 1 < ranked.length && ranked[j + 1]!.elapsedMs === ranked[i]!.elapsedMs) j++;
    const bonus = clamp(s.timeBonus[i] ?? 0, 0, MAX_TIME_BONUS);
    for (let k = i; k <= j; k++) out.set(ranked[k]!.id, bonus);
    i = j + 1;
  }
  return out;
}

export function computeStandings(teams: TeamScoreInput[], settings: Settings): Standing[] {
  const players = teams.filter((t) => !t.isRehearsal);
  const base = players.map((t) => {
    const clues = clamp(t.clueMarks, 0, MAX_CLUE_MARKS);
    const final = t.finalRevoked ? 0 : clamp(t.finalMarks, 0, settings.finalStageMarks);
    const teamworkMarks = clamp(t.teamwork ?? 0, 0, settings.teamworkMax);
    const eligibleForBonus =
      t.status === "FINISHED" && clues === MAX_CLUE_MARKS && final === settings.finalStageMarks;
    return { ...t, clues, final, teamworkMarks, eligibleForBonus };
  });
  const eligibleIds = new Set(base.filter((b) => b.eligibleForBonus).map((b) => b.id));
  const bonus = timeBonuses(base, (id) => eligibleIds.has(id), settings);
  const rows: Standing[] = base.map((b) => {
    const timeBonus = b.status === "DISQUALIFIED" ? 0 : (bonus.get(b.id) ?? 0);
    const total =
      b.status === "DISQUALIFIED" ? 0 : clamp(b.clues + b.final + b.teamworkMarks + timeBonus + b.adjustMarks, 0, 100);
    return { ...b, timeBonus, total, rank: null };
  });
  const order = (a: Standing, b: Standing) => {
    const dq = Number(a.status === "DISQUALIFIED") - Number(b.status === "DISQUALIFIED");
    if (dq !== 0) return dq;
    if (b.total !== a.total) return b.total - a.total;
    const ea = a.elapsedMs ?? Number.POSITIVE_INFINITY;
    const eb = b.elapsedMs ?? Number.POSITIVE_INFINITY;
    if (ea !== eb) return ea - eb;
    return a.id.localeCompare(b.id);
  };
  rows.sort(order);
  let rank = 0;
  rows.forEach((r, idx) => {
    if (r.status === "DISQUALIFIED") return;
    const prev = rows[idx - 1];
    if (!prev || prev.total !== r.total || (prev.elapsedMs ?? -1) !== (r.elapsedMs ?? -1)) rank = idx + 1;
    r.rank = rank;
  });
  return rows;
}
