/**
 * AES-GCM encryption of team passwords so organisers can re-print credential slips.
 * Key derived from SESSION_SECRET. Web Crypto only (Node 20+ and Workers).
 */
const enc = new TextEncoder();
const dec = new TextDecoder();

async function keyFrom(secret: string) {
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(`abit-slip:${secret}`));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function sealText(plain: string, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await keyFrom(secret), enc.encode(plain)));
  return `${b64(iv)}.${b64(ct)}`;
}

export async function openText(sealed: string | null | undefined, secret: string): Promise<string | null> {
  if (!sealed) return null;
  try {
    const [iv, ct] = sealed.split(".");
    if (!iv || !ct) return null;
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await keyFrom(secret), unb64(ct));
    return dec.decode(pt);
  } catch {
    return null;
  }
}
