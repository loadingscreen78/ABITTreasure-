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
      ["A", 96, 2],
      ["C", 96, 3],
    ]);
  });
  it("adjustments apply and total is clamped to 0..100", () => {
    const rows = computeStandings([team("A", { adjustMarks: 50, elapsedMs: 1 }), team("B", { adjustMarks: -500, elapsedMs: 2 })], S);
    expect(rows.find((r) => r.id === "A")!.total).toBe(100);
    expect(rows.find((r) => r.id === "B")!.total).toBe(0);
  });
});
