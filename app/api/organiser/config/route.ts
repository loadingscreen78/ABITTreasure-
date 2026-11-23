import { readEnv } from "@/lib/env";
import { fail, handler, json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Public values for the organiser login form (publishable key is browser-safe because RLS is on). */
export const GET = handler("organiser/config", async () => {
  const e = readEnv();
  if (!e.ok) return fail("SETUP", `Setup incomplete — missing ${e.missing.join(", ")}`, 503, { missing: e.missing });
  return json({ ok: true, url: e.env.NEXT_PUBLIC_SUPABASE_URL, publishableKey: e.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY });
});
