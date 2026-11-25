import { readEnv } from "@/lib/env";
import { adminClient } from "@/lib/supabase/admin";
import { withDefaults } from "@/lib/game/scoring";
import { handler, json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const count = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
  try {
    const r = await q;
    return r.error ? 0 : (r.count ?? 0);
  } catch {
    return 0;
  }
};

/** Public, content-free status for the home page: event state + how many teams have enlisted. */
export const GET = handler("public/status", async () => {
  const e = readEnv();
  if (!e.ok) return json({ ok: true, status: "DRAFT", startedAt: null, enlisted: null, registrationOpen: true });
  const db = adminClient(e.env);
  const [ev, teams, regs] = await Promise.all([
    db.from("event_state").select("status, started_at, settings").eq("id", 1).maybeSingle(),
    count(db.from("teams").select("id", { count: "exact", head: true }).eq("is_rehearsal", false)),
    count(db.from("registrations").select("id", { count: "exact", head: true }).eq("status", "PENDING")),
  ]);
  const evd = (ev.data ?? null) as { status: string; started_at: string | null; settings: Record<string, unknown> } | null;
  return json(
    {
      ok: true,
      status: evd?.status ?? "DRAFT",
      startedAt: evd?.started_at ?? null,
      enlisted: teams + regs,
      registrationOpen: withDefaults(evd?.settings).registrationOpen,
      now: new Date().toISOString(),
    },
    200,
    { "Cache-Control": "public, max-age=10" },
  );
});
