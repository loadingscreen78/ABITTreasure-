import { readEnv } from "@/lib/env";
import { adminClient } from "@/lib/supabase/admin";
import { safe } from "@/lib/server/db";
import { handler, json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Pre-event check: env present + DB round-trip + content seeded. Reports names only, never values. */
export const GET = handler("health", async () => {
  const e = readEnv();
  if (!e.ok) return json({ ok: false, env: { ok: false, missing: e.missing }, db: { ok: false } }, 503);
  const db = adminClient(e.env);
  const t0 = Date.now();
  const r = await safe(db.from("event_state").select("status").eq("id", 1).maybeSingle(), "health");
  const latencyMs = Date.now() - t0;
  const cps = await safe(db.from("checkpoints").select("code"), "health cps");
  const qs = await safe(db.from("questions").select("id"), "health qs");
  const checkpoints = Array.isArray(cps.data) ? cps.data.length : 0;
  const questions = Array.isArray(qs.data) ? qs.data.length : 0;
  const ok = !r.error && !!r.data && checkpoints === 8 && questions === 9;
  return json(
    {
      ok,
      env: { ok: true, missing: [] },
      db: { ok: !r.error && !!r.data, latencyMs, status: (r.data as { status?: string } | null)?.status ?? null },
      content: { ok: checkpoints === 8 && questions === 9, checkpoints, questions },
    },
    ok ? 200 : 503,
  );
});
