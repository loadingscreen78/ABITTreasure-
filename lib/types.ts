/** Shapes sent to the team phone. Built on the server for one team's current state only. */

export type Gate = "NOT_STARTED" | "PAUSED" | "TIMES_UP" | "DISQUALIFIED";
export type Banner = "ARRIVED" | "WRONG_TURN" | "ALREADY_CLEARED" | "ANOTHER_PHONE" | null;

export interface TeamHeader {
  id: string;
  name: string;
  cleared: number;
  current: number;
  total: number;
  startedAt: string | null;
  serverNow: string;
  rehearsal: boolean;
  /** Hint-wallet balance (separate from the 100-mark score). */
  wallet: number;
}

export interface QuestionView {
  id: string;
  clue: number;
  title: string;
  prompt: string;
  code: string | null;
  index: number;
  total: number;
  wrongCount: number;
  fullWithin: number;
  cooldownUntil: string | null;
  cooldownSeconds: number;
  isFinal: boolean;
  /** Paid hints for this question. `text` is only present once the team has bought it. */
  hints: { level: HintLevel; cost: number; bought: boolean; text: string | null }[];
}

export type HintLevel = "low" | "medium" | "high";

export interface ClueView {
  clue: number | null;
  title: string;
  riddle: string;
  nextOrder: number;
  hasNudge: boolean;
  nudge: string | null;
}

export type TeamView =
  | { kind: "login"; cp: number | null; reason?: "expired" | "every-scan" }
  | { kind: "invalid" }
  | { kind: "setup" }
  | { kind: "error"; message: string }
  | { kind: "gate"; gate: Gate; header: TeamHeader; startsAt: string | null }
  | { kind: "start"; header: TeamHeader; banner: Banner }
  | {
      kind: "question";
      header: TeamHeader;
      cp: { order: number; arrival: { title: string; answer: string; marks: number | null } | null; note: string | null };
      question: QuestionView;
      banner: Banner;
    }
  | { kind: "clue"; header: TeamHeader; clue: ClueView; banner: Banner }
  | { kind: "finished"; header: TeamHeader; finishedAt: string | null; elapsedMs: number | null; judgeCode: string | null; phrase: string | null };

export interface SubmitResult {
  outcome: "CORRECT" | "WRONG" | "NEAR_MISS" | "COOLDOWN" | "ALREADY_SOLVED" | "STALE" | "EMPTY" | "BLOCKED" | "RATE_LIMIT";
  marks?: number;
  attemptNo?: number;
  attemptsLeft?: number;
  scoring?: boolean;
  cooldownUntil?: string | null;
  message?: string;
  retryAt?: string | null;
}

export type ApiResult<T> = ({ ok: true } & T) | { ok: false; code: string; message: string; view?: TeamView };
