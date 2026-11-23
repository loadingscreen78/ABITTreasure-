import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HuntSchema, type Hunt } from "@/lib/content/schema";

// Runs against the real (gitignored) hunt.json when present, and always against the
// committed placeholder hunt.example.json so CI checks the structure too.
const files = ["content/hunt.example.json", "content/hunt.json"].filter((f) => existsSync(f));

for (const file of files) {
  describe(`content integrity: ${file}`, () => {
    const hunt: Hunt = HuntSchema.parse(JSON.parse(readFileSync(file, "utf8")));
    const cps = [...hunt.checkpoints].sort((a, b) => a.order - b.order);

    it("has 8 checkpoints CP-01…CP-08 in order", () => {
      expect(cps.map((c) => c.code)).toEqual(["CP-01", "CP-02", "CP-03", "CP-04", "CP-05", "CP-06", "CP-07", "CP-08"]);
      expect(cps.map((c) => c.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it("every reveal.leadsTo is the next checkpoint", () => {
      for (let i = 0; i < cps.length - 1; i++) expect(cps[i]!.reveal?.leadsTo, cps[i]!.code).toBe(cps[i + 1]!.code);
      expect(cps.at(-1)!.reveal).toBeNull();
    });

    it("the riddle at CP-n is the location clue credited on arrival at CP-(n+1), for CP-01…CP-06", () => {
      for (let i = 0; i < 6; i++) {
        const here = cps[i]!;
        const next = cps[i + 1]!;
        expect(next.arrivalCredit, next.code).not.toBeNull();
        expect(here.reveal!.clue, `${here.code} → ${next.code}`).toBe(next.arrivalCredit!.clue);
        expect(here.reveal!.title).toBe(next.arrivalCredit!.title);
      }
    });

    it("clue numbers 1–15 each appear exactly once across questions + arrival credits", () => {
      const clues = cps.flatMap((c) => [...c.questions.map((q) => q.clue), ...(c.arrivalCredit ? [c.arrivalCredit.clue] : [])]);
      expect([...clues].sort((a, b) => a - b)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    });

    it("question clues are 1,3,5,7,8,10,12,14,15 and location clues 2,4,6,9,11,13", () => {
      expect(cps.flatMap((c) => c.questions.map((q) => q.clue))).toEqual([1, 3, 5, 7, 8, 10, 12, 14, 15]);
      expect(cps.flatMap((c) => (c.arrivalCredit ? [c.arrivalCredit.clue] : []))).toEqual([2, 4, 6, 9, 11, 13]);
    });

    it("CP-04 asks clue 7 then clue 8; CP-06 asks for the secret word; CP-08 is final", () => {
      expect(cps[3]!.questions.map((q) => q.clue)).toEqual([7, 8]);
      expect(cps[5]!.questions[0]!.match).toBe("secret-word");
      expect(cps[7]!.questions[0]!.isFinal).toBe(true);
      expect(cps.flatMap((c) => c.questions).filter((q) => q.isFinal)).toHaveLength(1);
    });

    it("question IDs are unique", () => {
      const ids = cps.flatMap((c) => c.questions.map((q) => q.id));
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
}

describe.runIf(existsSync("content/hunt.json"))("hunt.json matches the organisers' Section 3 summary", () => {
  const hunt: Hunt = HuntSchema.parse(JSON.parse(readFileSync("content/hunt.json", "utf8")));
  it("locations in checkpoint order", () => {
    expect(hunt.checkpoints.map((c) => c.location)).toEqual([
      "Registration / Start desk",
      "Library",
      "Notice board",
      "Computer laboratory",
      "Reception",
      "Auditorium / Seminar hall",
      "Drinking-water station",
      "Registration / Finish desk",
    ]);
  });
  it("question titles in order", () => {
    expect(hunt.checkpoints.flatMap((c) => c.questions.map((q) => q.title))).toEqual([
      "The Brain of the Computer",
      "Binary Decode",
      "Guess the Language",
      "Logic Puzzle",
      "First Letter Challenge",
      "HTML Tag",
      "QR Code Challenge",
      "Java Output",
      "Final Treasure",
    ]);
  });
});
