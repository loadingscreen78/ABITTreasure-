import { describe, expect, it } from "vitest";
import { htmlTagName, matchAnswer, normalize, type MatchableQuestion } from "@/lib/game/match";

// Synthetic fixtures only — the real accept lists live in the gitignored content files.
const q = (match: MatchableQuestion["match"], accept: string[], nearMiss: Record<string, string> = {}): MatchableQuestion => ({
  match,
  accept,
  nearMiss,
});

describe("normalize", () => {
  it.each([
    ["  Hello  ", "hello"],
    ["\"Quoted\"", "quoted"],
    ["`code`", "code"],
    ["Done!!", "done"],
    ["What?", "what"],
    ["a   b\t c", "a b c"],
    ["The Answer", "answer"],
    ["answer: X", "x"],
    ["Ans: y.", "y"],
    ["“Curly”", "curly"],
    ["ＦＵＬＬＷＩＤＴＨ", "fullwidth"],
    ["answer: \"The Thing.\"", "thing"],
  ])("%j → %j", (input, out) => expect(normalize(input)).toBe(out));
});

describe("exact", () => {
  const Q = q("exact", ["alpha", "letter alpha"], { beta: "Close!" });
  it.each(["alpha", "ALPHA", " Alpha ", "'alpha'", "alpha.", "letter alpha", "the alpha", "Answer: alpha"])("accepts %j", (s) =>
    expect(matchAnswer(Q, s, "").correct).toBe(true),
  );
  it.each(["alph", "alphas", "gamma", "", "a l p h a", "letteralpha", "alpha beta", "1"])("rejects %j", (s) =>
    expect(matchAnswer(Q, s, "").correct).toBe(false),
  );
  it("flags near-miss without accepting", () => {
    expect(matchAnswer(Q, "Beta", "")).toMatchObject({ correct: false, nearMiss: "Close!" });
  });
});

describe("acronym", () => {
  const Q = q("acronym", ["rom", "read only memory"]);
  it.each(["ROM", "R.O.M", "r o m", "R-O-M", "R.O.M.", "Read Only Memory", "read-only memory", "\"rom\""])("accepts %j", (s) =>
    expect(matchAnswer(Q, s, "").correct).toBe(true),
  );
  it.each(["RAM", "ROMS", "RO", "memory", "MOR", "r o m x", "", "read memory"])("rejects %j", (s) =>
    expect(matchAnswer(Q, s, "").correct).toBe(false),
  );
});

describe("number", () => {
  const Q = q("number", ["7", "seven"]);
  it.each(["7", "7.0", "seven", "Seven", " 7 ", "7.", "+7", "07"])("accepts %j", (s) => expect(matchAnswer(Q, s, "").correct).toBe(true));
  it.each(["8", "70", "6", "7.5", "sevens", "", "-7", "eight"])("rejects %j", (s) =>
    expect(matchAnswer(Q, s, "").correct).toBe(false),
  );
});

describe("html-tag", () => {
  const Q = q("html-tag", ["p", "paragraph"], { class: "That is an attribute." });
  it.each(["<p>", "p", "P tag", "<p class=\"\">", "<p></p>", "paragraph", "paragraph tag", "</p>", "html p element"])("accepts %j", (s) =>
    expect(matchAnswer(Q, s, "").correct).toBe(true),
  );
  it.each(["<pre>", "pre", "<span>", "text", "para", "<div>", "class", "", "p p"])("rejects %j", (s) =>
    expect(matchAnswer(Q, s, "").correct).toBe(false),
  );
  it("extracts first tag name", () => {
    expect(htmlTagName("<  div class='x'>")).toBe("div");
    expect(htmlTagName("span element")).toBe("span");
  });
  it("near-miss on attribute", () => expect(matchAnswer(Q, "class", "").nearMiss).toBe("That is an attribute."));
});

describe("no-such-number", () => {
  const Q = q("no-such-number", ["none", "no such number", "doesnt exist", "no"]);
  it.each(["none", "None.", "no such number", "there is no such number!", "doesn't exist", "it does not exist", "impossible", "no solution", "not possible", "no"])(
    "accepts %j",
    (s) => expect(matchAnswer(Q, s, "").correct).toBe(true),
  );
  it.each(["12", "13", "14", "11", "0", "2", "twelve", "none of them, 12", "maybe", ""])("rejects %j", (s) =>
    expect(matchAnswer(Q, s, "").correct).toBe(false),
  );
});

describe("secret-word", () => {
  const Q = q("secret-word", ["{{settings.secretWord}}"]);
  it.each(["ORBIT", "orbit", " Orbit ", "orbit.", "'ORBIT'", "the orbit", "Orbit!", "\"orbit\""])("accepts %j", (s) =>
    expect(matchAnswer(Q, s, "ORBIT").correct).toBe(true),
  );
  it.each(["orbi", "orbits", "spark", "", "{{settings.secretWord}}", "o r b i t x", "word", "secret"])("rejects %j", (s) =>
    expect(matchAnswer(Q, s, "ORBIT").correct).toBe(false),
  );
  it("follows the current secret word", () => {
    expect(matchAnswer(Q, "comet", "COMET").correct).toBe(true);
    expect(matchAnswer(Q, "orbit", "COMET").correct).toBe(false);
  });
  it("never matches an empty secret word", () => expect(matchAnswer(Q, "", "").correct).toBe(false));
});
