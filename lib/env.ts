import "server-only";
import { z } from "zod";

/**
 * Runtime env validation. Never throws: callers get { ok:false, missing } and render a
 * branded "setup incomplete" state instead of a stack trace. Values are never logged.
 */
const Schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(10),
  SUPABASE_SECRET_KEY: z.string().min(10),
  SUPABASE_JWKS_URL: z.string().url().optional().or(z.literal("")),
  SESSION_SECRET: z.string().min(32),
  PUBLIC_BASE_URL: z.string().url(),
  SECRET_WORD: z.string().optional(),
  BCRYPT_COST: z.coerce.number().int().min(4).max(14).optional(),
});

export type Env = z.infer<typeof Schema>;
export type EnvResult = { ok: true; env: Env } | { ok: false; missing: string[] };

export function readEnv(): EnvResult {
  const raw = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    SUPABASE_JWKS_URL: process.env.SUPABASE_JWKS_URL || undefined,
    SESSION_SECRET: process.env.SESSION_SECRET,
    PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL,
    SECRET_WORD: process.env.SECRET_WORD || undefined,
    BCRYPT_COST: process.env.BCRYPT_COST || undefined,
  };
  const r = Schema.safeParse(raw);
  if (r.success) return { ok: true, env: r.data };
  const missing = [...new Set(r.error.issues.map((i) => String(i.path[0])))];
  return { ok: false, missing };
}

export function publicBaseUrl(env: Env): string {
  return env.PUBLIC_BASE_URL.replace(/\/+$/, "");
}
