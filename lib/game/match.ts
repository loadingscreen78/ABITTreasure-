/**
 * Answer matching (Section 4). Pure functions, no I/O.
 * Answers never ship to the browser: this module is only imported by server code,
 * and the accept lists it compares against come from the database.
 */

export type MatchMode = "exact" | "acronym" | "number" | "html-tag" | "no-such-number" | "secret-word";

export interface MatchableQuestion {
  match: MatchMode;
  accept: string[];
  nearMiss: Record<string, string>;
}

export interface MatchResult {
  correct: boolean;
  /** Set when the input is a known near-miss: show the message, do not count an attempt. */
  nearMiss: string | null;
  normalized: string;
}

const QUOTES = /^[\s"'`“”‘’«»]+|[\s"'`“”‘’«»]+$/g;
const TRAILING_PUNCT = /[.,!?;:]+$/;
const LEADING_FILLER = /^(?:the\s+|answer\s*:\s*|ans\s*:\s*)/;

/** NFKC → lowercase → trim → strip quotes/backticks → strip trailing .,!?;: → collapse spaces → strip "the "/"answer:"/"ans:". */
export function normalize(input: string): string {
  let s = (input ?? "").normalize("NFKC").toLowerCase().trim();
  // Iterate so combinations like `"The CPU."` or `answer: "c"` fully unwrap.
  for (let i = 0; i < 4; i++) {
    const before = s;
    s = s.replace(QUOTES, "");
    s = s.replace(TRAILING_PUNCT, "");
    s = s.replace(/\s+/g, " ").trim();
    s = s.replace(LEADING_FILLER, "").trim();
    if (s === before) break;
  }
  return s;
}

const compact = (s: string) => s.replace(/[.\s-]/g, "");
const noApostrophes = (s: string) => s.replace(/['’`]/g, "");

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20,
};

function asNumber(s: string): number | null {
  const t = s.replace(/\s+/g, "");
  if (/^[+-]?\d+(?:\.\d+)?$/.test(t)) return Number(t);
  if (t in NUMBER_WORDS) return NUMBER_WORDS[t] ?? null;
  return null;
}

const NO_SUCH_PHRASES = ["none", "no such", "does not exist", "doesnt exist", "not possible", "impossible", "no solution", "no number"];

/** Reduce an html-tag answer to the bare tag name. */
export function htmlTagName(normalized: string): string {
  if (normalized.includes("<")) {
    const m = /<\s*\/?\s*([a-z0-9]+)/i.exec(normalized);
    return m?.[1]?.toLowerCase() ?? "";
  }
  return normalized
    .replace(/\b(?:tag|element|html)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Form used to compare an input against the accept list and near-miss keys for a given mode. */
function canonical(mode: MatchMode, normalized: string): string {
  switch (mode) {
    case "acronym":
      return compact(normalized);
    case "html-tag":
      return htmlTagName(normalized);
    case "no-such-number":
      return noApostrophes(normalized);
    case "number": {
      const n = asNumber(normalized);
      return n === null ? normalized.replace(/\s+/g, "") : String(n);
    }
    default:
      return normalized;
  }
}

function isCorrect(q: MatchableQuestion, normalized: string, secretWord: string): boolean {
  if (!normalized) return false;
  const mode = q.match;
  if (mode === "secret-word") {
    const target = normalize(secretWord);
    return target.length > 0 && normalized === target;
  }
  const accepts = q.accept.map((a) => normalize(a));
  if (accepts.includes(normalized)) return true;
  const c = canonical(mode, normalized);
  if (accepts.some((a) => canonical(mode, a) === c)) return true;
  if (mode === "no-such-number") {
    if (/\d/.test(normalized)) return false;
    return NO_SUCH_PHRASES.some((p) => c.includes(p));
  }
  return false;
}

export function matchAnswer(q: MatchableQuestion, raw: string, secretWord: string): MatchResult {
  const normalized = normalize(raw);
  if (isCorrect(q, normalized, secretWord)) return { correct: true, nearMiss: null, normalized };
  const c = canonical(q.match, normalized);
  for (const [key, message] of Object.entries(q.nearMiss ?? {})) {
    const k = normalize(key);
    if (k === normalized || canonical(q.match, k) === c) return { correct: false, nearMiss: message, normalized };
  }
  return { correct: false, nearMiss: null, normalized };
}
