import { describe, expect, it } from "vitest";
import {
  computeStandings,
  cooldownAfterWrong,
  DEFAULT_SETTINGS,
  marksForAttempt,
  timeBonuses,
  type TeamScoreInput,
} from "@/lib/game/scoring";

const S = DEFAULT_SETTINGS;
const team = (id: string, over: Partial<TeamScoreInput> = {}): TeamScoreInput => ({
  id,
  name: id,
  status: "FINISHED",
  isRehearsal: false,
  clueMarks: 75,
  finalMarks: 15,
  adjustMarks: 0,
  finalRevoked: false,
  teamwork: 5,
  elapsedMs: 600_000,
  ...over,
});

describe("attempt policy", () => {
  it("full marks on attempts 1–3, zero after", () => {
    expect([1, 2, 3, 4, 5].map((n) => marksForAttempt(n, S))).toEqual([5, 5, 5, 0, 0]);
  });
  it("cooldown only on wrong attempts beyond the limit", () => {
    expect([1, 2, 3, 4, 5].map((n) => cooldownAfterWrong(n, S))).toEqual([false, false, false, true, true]);
  });
});

describe("time bonus", () => {
  it("awards 5/3/1 to the three fastest eligible teams", () => {
    const b = timeBonuses([team("A", { elapsedMs: 3 }), team("B", { elapsedMs: 1 }), team("C", { elapsedMs: 2 }), team("D", { elapsedMs: 4 })], () => true, S);
    expect(Object.fromEntries(b)).toEqual({ B: 5, C: 3, A: 1, D: 0 });
  });
  it("ties share a tier and the next team skips it", () => {
    const b = timeBonuses([team("A", { elapsedMs: 1 }), team("B", { elapsedMs: 1 }), team("C", { elapsedMs: 2 })], () => true, S);
    expect(Object.fromEntries(b)).toEqual({ A: 5, B: 5, C: 1 });
  });
  it("ignores ineligible teams", () => {
    const b = timeBonuses([team("A", { elapsedMs: 1 }), team("B", { elapsedMs: 2 })], (id) => id === "B", S);
    expect(Object.fromEntries(b)).toEqual({ B: 5 });
  });
  it("caps at 5 even if configured higher", () => {
    const b = timeBonuses([team("A")], () => true, { timeBonus: [9], timeBonusMode: "tiered" });
    expect(b.get("A")).toBe(5);
  });
  it("tie-breaker mode awards nothing", () => {
    expect(timeBonuses([team("A")], () => true, { ...S, timeBonusMode: "tiebreak" }).size).toBe(0);
  });
});

describe("standings", () => {
  it("a perfect fastest team scores exactly 100 (75+15+5+5)", () => {
    const [r] = computeStandings([team("T01", { elapsedMs: 1 })], S);
    expect(r).toMatchObject({ clues: 75, final: 15, teamworkMarks: 5, timeBonus: 5, total: 100, rank: 1 });
  });
  it("teams missing any clue marks are not bonus-eligible", () => {
    const rows = computeStandings([team("T01", { clueMarks: 70, elapsedMs: 1 }), team("T02", { elapsedMs: 9 })], S);
    const t1 = rows.find((r) => r.id === "T01")!;
    const t2 = rows.find((r) => r.id === "T02")!;
    expect(t1.timeBonus).toBe(0);
    expect(t2.timeBonus).toBe(5);
  });
  it("revoked final removes 15 and bonus eligibility", () => {
    const [r] = computeStandings([team("T01", { finalRevoked: true })], S);
    expect(r).toMatchObject({ final: 0, timeBonus: 0, total: 80 });
  });
  it("disqualified teams score 0 and have no rank", () => {
    const rows = computeStandings([team("T01", { status: "DISQUALIFIED" }), team("T02", { clueMarks: 10, finalMarks: 0, status: "ACTIVE", elapsedMs: null })], S);
    expect(rows.at(-1)).toMatchObject({ id: "T01", total: 0, rank: null });
    expect(rows[0]).toMatchObject({ id: "T02", rank: 1 });
  });
  it("rehearsal team T00 is excluded", () => {
    expect(computeStandings([team("T00", { isRehearsal: true })], S)).toHaveLength(0);
  });
  it("ranks by total, then elapsed time", () => {
    const rows = computeStandings(
      [team("A", { teamwork: 3, elapsedMs: 5 }), team("B", { teamwork: 3, elapsedMs: 4 }), team("C", { teamwork: 5, elapsedMs: 9 })],
      S,
    );
    // B fastest: 75+15+3+5=98; C: 75+15+5+1=96; A: 75+15+3+3=96, C faster? no: A=5ms < C=9ms
    expect(rows.map((r) => [r.id, r.total, r.rank])).toEqual([
      ["B", 98, 1],
      ["A", 96.5, 2],
      ["C", 96.25, 3],
    ]);
  });
  it("adjustments apply and total is clamped to 0..100", () => {
    const rows = computeStandings([team("A", { adjustMarks: 50, elapsedMs: 1 }), team("B", { adjustMarks: -500, elapsedMs: 2 })], S);
    expect(rows.find((r) => r.id === "A")!.total).toBe(100);
    expect(rows.find((r) => r.id === "B")!.total).toBe(0);
  });
});

describe("tie-break points (same total → faster team gets more)", () => {
  it("3-way tie: +0.5 / +0.25 / +0.1 by finish time", () => {
    const rows = computeStandings(
      [
        team("A", { clueMarks: 60, teamwork: 3, elapsedMs: 900 }),
        team("B", { clueMarks: 60, teamwork: 3, elapsedMs: 700 }),
        team("C", { clueMarks: 60, teamwork: 3, elapsedMs: 800 }),
      ],
      S,
    );
    expect(rows.map((r) => [r.id, r.total, r.tieBreak, r.rank])).toEqual([
      ["B", 78.5, 0.5, 1],
      ["C", 78.25, 0.25, 2],
      ["A", 78.1, 0.1, 3],
    ]);
  });
  it("never lifts a team above one that genuinely scored more", () => {
    const rows = computeStandings([team("A", { clueMarks: 60, teamwork: 3, elapsedMs: 1 }), team("B", { clueMarks: 60, teamwork: 3, elapsedMs: 2 }), team("X", { clueMarks: 60, teamwork: 4, elapsedMs: 999 })], S);
    expect(rows[0]).toMatchObject({ id: "X", total: 79, tieBreak: 0 });
    expect(rows[1]).toMatchObject({ id: "A", total: 78.5 });
  });
  it("a finished team beats unfinished teams on the same total; no tie → no tie-break", () => {
    const rows = computeStandings(
      [team("A", { status: "ACTIVE", clueMarks: 40, finalMarks: 0, teamwork: 0, elapsedMs: null }), team("B", { clueMarks: 40, finalMarks: 0, teamwork: 0, elapsedMs: 5 }), team("C", { clueMarks: 10, finalMarks: 0, teamwork: 0, elapsedMs: 9 })],
      S,
    );
    expect(rows.find((r) => r.id === "B")).toMatchObject({ total: 40.5, rank: 1 });
    expect(rows.find((r) => r.id === "A")).toMatchObject({ total: 40, tieBreak: 0 });
    expect(rows.find((r) => r.id === "C")!.tieBreak).toBe(0);
  });
  it("identical finish times share the tier; a tie with equal times awards nothing", () => {
    const same = computeStandings([team("A", { clueMarks: 50, elapsedMs: 5 }), team("B", { clueMarks: 50, elapsedMs: 5 })], S);
    expect(same.every((r) => r.tieBreak === 0)).toBe(true);
    const three = computeStandings([team("A", { clueMarks: 50, elapsedMs: 5 }), team("B", { clueMarks: 50, elapsedMs: 5 }), team("C", { clueMarks: 50, elapsedMs: 9 })], S);
    expect(Object.fromEntries(three.map((r) => [r.id, r.tieBreak]))).toEqual({ A: 0.5, B: 0.5, C: 0.1 });
  });
});
