import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import type { Page } from "@playwright/test";

export const hasSecrets = !!process.env.SUPABASE_SECRET_KEY && existsSync("content/hunt.json");

export const db = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

export interface Hunt {
  checkpoints: {
    code: string;
    order: number;
    arrivalNote: string | null;
    questions: { id: string; clue: number; title: string; prompt: string; match: string; accept: string[] }[];
    reveal: { clue: number | null; riddle: string; nudge: string | null } | null;
  }[];
}
export const hunt = (): Hunt => JSON.parse(readFileSync("content/hunt.json", "utf8"));

export const T00_PASSWORD = "E2ETEST";

/** Fresh T00: known password, all progress wiped, every old session signed out. */
export async function resetT00() {
  const c = db();
  const { data } = await c.from("teams").select("session_version").eq("id", "T00").single();
  await c.from("teams").update({ password_hash: await bcrypt.hash(T00_PASSWORD, 5), session_version: (data?.session_version ?? 1) + 1 }).eq("id", "T00");
  await c.rpc("reset_team", { p_team_id: "T00" });
}

/** Move T00's attempts out of the 60 s answer rate-limit window (keeps long UI runs deterministic). */
export async function ageAttempts() {
  await db().from("attempts").update({ at: new Date(Date.now() - 180_000).toISOString() }).eq("team_id", "T00");
}

export async function tokens(): Promise<Record<string, string>> {
  const { data } = await db().from("checkpoints").select("code, token");
  return Object.fromEntries((data ?? []).map((r) => [r.code, r.token]));
}

export async function gameSettings(): Promise<{ full: number; cooldown: number }> {
  const { data } = await db().from("event_state").select("settings").eq("id", 1).single();
  const s = (data?.settings ?? {}) as { fullMarksWithinAttempts?: number; cooldownSecondsAfterLimit?: number };
  return { full: s.fullMarksWithinAttempts ?? 3, cooldown: s.cooldownSecondsAfterLimit ?? 15 };
}

export async function secretWord(): Promise<string> {
  const { data } = await db().from("event_state").select("settings").eq("id", 1).single();
  return (data?.settings as { secretWord: string }).secretWord;
}

export function answerFor(q: Hunt["checkpoints"][number]["questions"][number], secret: string) {
  if (q.match === "secret-word") return secret.toLowerCase();
  if (q.match === "html-tag") return "<a>";
  return q.accept[0]!;
}

export function organiser(role: "admin" | "judge"): { email: string; password: string } | null {
  const f = readdirSync(".").filter((x) => /^organisers-.*\.txt$/.test(x)).sort().at(-1);
  if (!f) return null;
  const line = readFileSync(f, "utf8").split(/\r?\n/).find((l) => l.startsWith(role + "\t"));
  if (!line) return null;
  const [, email, password] = line.split("\t");
  return { email: email!, password: password! };
}

export async function shot(page: Page, name: string, project: string) {
  mkdirSync("qa/screens", { recursive: true });
  await page.screenshot({ path: `qa/screens/${project}-${name}.png`, fullPage: true });
}
