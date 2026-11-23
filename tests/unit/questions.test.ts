import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HuntSchema } from "@/lib/content/schema";
import { matchAnswer, type MatchableQuestion } from "@/lib/game/match";

// Real accept/reject tables for every question. Both files are gitignored (the public repo
// must never contain answers), so this suite runs locally and is skipped in CI.
const huntPath = "content/hunt.json";
const casesPath = "content/answer-cases.json";
const available = existsSync(huntPath) && existsSync(casesPath);

describe.runIf(available)("real questions (Section 3 / Section 4)", () => {
  const hunt = HuntSchema.parse(JSON.parse(readFileSync(huntPath, "utf8")));
  const cases = JSON.parse(readFileSync(casesPath, "utf8")) as Record<string, { accept: string[]; reject: string[]; nearMiss: string[] }>;
  const questions = hunt.checkpoints.flatMap((c) => c.questions);
  const secret = hunt.settings.secretWord;

  it("has a case table with ≥8 accept and ≥8 reject for every question", () => {
    for (const qq of questions) {
      const c = cases[qq.id];
      expect(c, qq.id).toBeDefined();
      expect(c!.accept.length, `${qq.id} accept`).toBeGreaterThanOrEqual(8);
      expect(c!.reject.length, `${qq.id} reject`).toBeGreaterThanOrEqual(8);
    }
  });

  for (const qq of questions) {
    const c = cases[qq.id];
    if (!c) continue;
    const mq: MatchableQuestion = { match: qq.match, accept: qq.accept, nearMiss: qq.nearMiss };
    describe(qq.id, () => {
      it.each(c.accept)("accepts %j", (s) => expect(matchAnswer(mq, s, secret).correct).toBe(true));
      it.each(c.reject)("rejects %j", (s) => expect(matchAnswer(mq, s, secret).correct).toBe(false));
      if (c.nearMiss.length) {
        it.each(c.nearMiss)("near-miss %j does not count", (s) => {
          const r = matchAnswer(mq, s, secret);
          expect(r.correct).toBe(false);
          expect(r.nearMiss).toBeTruthy();
        });
      }
    });
  }
});
