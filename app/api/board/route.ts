import { readEnv } from "@/lib/env";
import { adminClient } from "@/lib/supabase/admin";
import { fail, handler, json } from "@/lib/server/http";
import { loadSnapshot } from "@/lib/server/snapshot";

export const dynamic = "force-dynamic";

/**
 * Public projector feed: team names + progress only. Scores appear only when
 * showScoresOnBoard is on or the admin has pressed "Reveal results".
 */
export const GET = handler("board", async () => {
  const e = readEnv();
  if (!e.ok) return fail("SETUP", "Event system is warming up.", 503);
  const snap = await loadSnapshot(adminClient(e.env));
  if (!snap) return fail("NETWORK", "Reconnecting…", 503);
  const revealed = snap.event.results_revealed;
  const showScores = revealed || snap.event.settings.showScoresOnBoard;
  const standing = new Map(snap.standings.map((s) => [s.id, s]));
  const players = snap.teams.filter((t) => !t.is_rehearsal);
  const lastArrival = (t: (typeof players)[number]) => Math.max(0, ...Object.values(t.arrivals).map((x) => new Date(x).getTime()));
  const rows = players
    .map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      cleared: t.cleared,
      current: Math.min(t.unlocked_cp, 8),
      elapsedMs: t.elapsedMs,
      finished: t.status === "FINISHED",
      total: showScores ? (standing.get(t.id)?.total ?? null) : null,
      rank: revealed ? (standing.get(t.id)?.rank ?? null) : null,
      _last: lastArrival(t),
    }))
    .sort((a, b) => {
      if (revealed) return (a.rank ?? 999) - (b.rank ?? 999);
      if (a.status === "DISQUALIFIED" || b.status === "DISQUALIFIED") return Number(a.status === "DISQUALIFIED") - Number(b.status === "DISQUALIFIED");
      if (b.cleared !== a.cleared) return b.cleared - a.cleared;
      if (a.finished && b.finished) return (a.elapsedMs ?? 0) - (b.elapsedMs ?? 0);
      return a._last - b._last;
    })
    .map(({ _last, ...r }, i) => ({ ...r, position: i + 1 }));
  return json({
    ok: true,
    now: snap.now,
    event: { status: snap.event.status, startedAt: snap.event.started_at, endsAt: snap.event.ends_at, revealed, showScores },
    rows,
  });
});
