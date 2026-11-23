/** Random tokens, passwords and ID helpers. Uses Web Crypto (works in Node 20+ and Cloudflare Workers). */

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
/** No 0/O/1/I/L. */
export const PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomString(alphabet: string, length: number): string {
  const out: string[] = [];
  const limit = 256 - (256 % alphabet.length); // rejection sampling → no modulo bias
  while (out.length < length) {
    const buf = new Uint8Array(length * 2);
    crypto.getRandomValues(buf);
    for (const b of buf) {
      if (b < limit) out.push(alphabet[b % alphabet.length]!);
      if (out.length === length) break;
    }
  }
  return out.join("");
}

/** 8-char base62 checkpoint token. */
export const newToken = () => randomString(BASE62, 8);

/** 7-char password, canonical form without the dash. */
export const newPassword = () => randomString(PASSWORD_ALPHABET, 7);

/** Display form: K7PM-RXQ */
export const formatPassword = (p: string) => (p.length === 7 ? `${p.slice(0, 4)}-${p.slice(4)}` : p);

/** Accepts "k7pm-rxq", "K7PM RXQ", "k7pmrxq" → "K7PMRXQ". */
export const canonicalPassword = (input: string) => input.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Accepts "t7", "T07", " t 07 " → "T07". Returns null if it is not a team ID. */
export function canonicalTeamId(input: string): string | null {
  const m = /^T\s*-?\s*(\d{1,3})$/i.exec(input.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return `T${String(n).padStart(2, "0")}`;
}

export const teamIdFor = (n: number) => `T${String(n).padStart(2, "0")}`;

export const REHEARSAL_TEAM_ID = "T00";

export function randomId(): string {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
