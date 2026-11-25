import { describe, expect, it } from "vitest";
import { afterArrive, afterCorrect, clearedCount, decideScan, type ProgressState } from "@/lib/game/progress";
import { canonicalPassword, canonicalTeamId, formatPassword, newPassword, newToken, PASSWORD_ALPHABET } from "@/lib/game/ids";
import { cpLabel, mmss } from "@/lib/game/format";

const S = (o: Partial<ProgressState> = {}): ProgressState => ({ unlockedCp: 4, arrived: false, qIndex: 0, status: "ACTIVE", ...o });

describe("scan decisions", () => {
  it("next checkpoint, not yet arrived → ARRIVE", () => expect(decideScan(S(), 4)).toBe("ARRIVE"));
  it("next checkpoint, already arrived → REPEAT", () => expect(decideScan(S({ arrived: true }), 4)).toBe("REPEAT"));
  it("earlier checkpoint → ALREADY_CLEARED", () => expect(decideScan(S(), 2)).toBe("ALREADY_CLEARED"));
  it("future checkpoint → WRONG_TURN", () => expect(decideScan(S(), 6)).toBe("WRONG_TURN"));
  it("finished team → FINISHED", () => expect(decideScan(S({ status: "FINISHED" }), 3)).toBe("FINISHED"));
});

describe("transitions", () => {
  it("two-question checkpoint: first correct stays, second advances", () => {
    const a = afterArrive(S());
    const b = afterCorrect(a, 2, false);
    expect(b).toMatchObject({ unlockedCp: 4, arrived: true, qIndex: 1 });
    const c = afterCorrect(b, 2, false);
    expect(c).toMatchObject({ unlockedCp: 5, arrived: false, qIndex: 0 });
  });
  it("final question finishes", () => expect(afterCorrect(S({ unlockedCp: 8, arrived: true }), 1, true).status).toBe("FINISHED"));
  it("punch count", () => {
    expect(clearedCount(S({ unlockedCp: 1 }))).toBe(0);
    expect(clearedCount(S({ unlockedCp: 5 }))).toBe(4);
    expect(clearedCount(S({ status: "FINISHED", unlockedCp: 8 }))).toBe(8);
  });
});

describe("ids", () => {
  it("tokens are 8-char base62 and unique", () => {
    const set = new Set(Array.from({ length: 500 }, newToken));
    expect(set.size).toBe(500);
    for (const t of set) expect(t).toMatch(/^[0-9A-Za-z]{8}$/);
  });
  it("passwords use the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const p = newPassword();
      expect(p).toHaveLength(7);
      for (const ch of p) expect(PASSWORD_ALPHABET).toContain(ch);
      expect(p).not.toMatch(/[0O1IL]/);
    }
  });
  it("password display and canonical forms round-trip", () => {
    expect(formatPassword("K7PMRXQ")).toBe("K7PM-RXQ");
    expect(canonicalPassword(" k7pm-rxq ")).toBe("K7PMRXQ");
  });
  it.each([
    ["t7", "T07"],
    ["T07", "T07"],
    [" t 07 ", "T07"],
    ["T-12", "T12"],
    ["t00", "T00"],
    ["TO1", "T01"],
    ["to7", "T07"],
    ["T 1O", "T10"],
  ])("team id %j → %j", (i, o) => expect(canonicalTeamId(i)).toBe(o));
  it("rejects non-team ids", () => expect(canonicalTeamId("admin")).toBeNull());
});

describe("format", () => {
  it("labels and clocks", () => {
    expect(cpLabel(4)).toBe("CP—04");
    expect(mmss(462_000)).toBe("07:42");
    expect(mmss(null)).toBe("--:--");
  });
});
