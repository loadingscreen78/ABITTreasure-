import { openText } from "@/lib/auth/secretbox";
import { publicBaseUrl } from "@/lib/env";
import { formatPassword } from "@/lib/game/ids";
import { safe } from "@/lib/server/db";
import { fail, handler, json } from "@/lib/server/http";
import { organiserRequest } from "@/lib/server/organiser-route";
import { answerKey, teamSheet } from "@/lib/server/reports";
import { loadSnapshot } from "@/lib/server/snapshot";

export const dynamic = "force-dynamic";

/** Data for the printable pages. QR codes are drawn in the browser from these strings. */
export const GET = handler("print", async (req: Request) => {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const judgeOk = kind === "answer-key" || kind === "team" || kind === "judge-sheet" || kind === "teams";
  const r = await organiserRequest(judgeOk ? ["admin", "judge"] : ["admin"]);
  if (!r.ok) return r.res;
  const { db, env } = r;
  const snap = await loadSnapshot(db);
  if (!snap) return fail("NETWORK", "Database unreachable.", 503);

  switch (kind) {
    case "checkpoints": {
      const base = publicBaseUrl(env);
      return json({ ok: true, base, cards: snap.checkpoints.map((c) => ({ code: c.code, order: c.order, url: `${base}/s/${c.token}` })) });
    }
    case "secret-word":
      return json({ ok: true, text: `Your secret word is ${snap.event.settings.secretWord}.` });
    case "credentials": {
      const t = await safe(db.from("teams").select("id, name, members, password_enc, is_rehearsal").order("id"), "creds");
      if (t.error) return fail("NETWORK", "Database unreachable.", 503);
      const rows = await Promise.all(
        (t.data as { id: string; name: string; members: string[]; password_enc: string | null; is_rehearsal: boolean }[]).map(async (x) => {
          const pw = await openText(x.password_enc, env.SESSION_SECRET);
          return { id: x.id, name: x.name, members: x.members, rehearsal: x.is_rehearsal, password: pw ? formatPassword(pw) : null };
        }),
      );
      return json({ ok: true, teams: rows });
    }
    case "answer-key": {
      const k = await answerKey(db, snap.event.settings.secretWord);
      return k ? json({ ok: true, ...k }) : fail("NETWORK", "Database unreachable.", 503);
    }
    case "teams":
      return json({ ok: true, teams: snap.teams.filter((t) => !t.is_rehearsal).map((t) => ({ id: t.id, name: t.name })) });
    case "team": {
      const id = url.searchParams.get("id") ?? "";
      const raw = await teamSheet(db, snap, id);
      if (!raw) return fail("NOT_FOUND", "No such team.", 404);
      return json({ ok: true, ...raw });
    }
    case "judge-sheet":
      return json({ ok: true, rows: snap.standings, event: snap.event.event });
    default:
      return fail("BAD_INPUT", "Unknown printable.", 400);
  }
});
