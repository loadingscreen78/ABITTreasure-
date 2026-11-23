"use client";
import { useSyncExternalStore } from "react";
import { Marquee, Wordmark } from "@/components/ui/brand";
import { useNow } from "@/components/ui/live";
import { BRAND } from "@/lib/brand";
import { mmss } from "@/lib/game/format";
import { usePoll } from "./useOrgData";

interface Row {
  id: string;
  name: string;
  status: string;
  cleared: number;
  current: number;
  elapsedMs: number | null;
  finished: boolean;
  total: number | null;
  rank: number | null;
  position: number;
}
interface BoardData {
  now: string;
  event: { status: string; startedAt: string | null; endsAt: string | null; revealed: boolean; showScores: boolean };
  rows: Row[];
}

const subscribe = (cb: () => void) => {
  window.addEventListener("popstate", cb);
  return () => window.removeEventListener("popstate", cb);
};
const useDark = () =>
  useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get("theme") === "dark",
    () => false,
  );

/** 16:9 projector leaderboard. Public (names + progress only); scores hidden until revealed. */
export default function Board() {
  const dark = useDark();
  const { data, error } = usePoll<BoardData>("/api/board");
  const now = useNow(1000);
  const fg = dark ? "var(--color-paper)" : "var(--color-ink)";
  const bg = dark ? "var(--color-ink)" : "transparent";
  const skew = data ? new Date(data.now).getTime() - now : 0;
  const started = data?.event.startedAt ? new Date(data.event.startedAt).getTime() : null;
  const elapsed = started && now + skew > started ? now + skew - started : null;

  return (
    <div style={{ minHeight: "100dvh", background: bg, color: fg, display: "flex", flexDirection: "column", fontSize: "clamp(14px, 1.3vw, 22px)" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 18, padding: "14px 2.5vw", borderBottom: `2px solid ${fg}` }}>
        <Wordmark size="md" />
        <span className="t-meta" style={{ fontSize: "0.7em" }}>
          {BRAND.instituteFull} · {BRAND.department} · {BRAND.series}
        </span>
        <span className="t-mono tabular" style={{ marginLeft: "auto", fontSize: "1.6em", fontWeight: 600 }}>
          {data?.event.status === "LIVE" ? mmss(elapsed) : data?.event.status ?? "—"}
        </span>
      </header>
      <div style={{ padding: "2vh 2.5vw 1vh", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20 }}>
        <h1 className="t-display" style={{ margin: 0, fontSize: "clamp(44px, 6.2vw, 120px)" }}>
          Tech Treasure Hunt
        </h1>
        <p className="t-meta" style={{ margin: 0, fontSize: "0.8em" }}>
          {BRAND.tagline}
        </p>
      </div>

      {error && !data && <p style={{ padding: "0 2.5vw" }}>Reconnecting…</p>}
      {data && data.rows.length === 0 && (
        <p className="t-display-sm" style={{ padding: "4vh 2.5vw", fontSize: "clamp(20px, 2.4vw, 40px)" }}>
          Waiting for teams · {data.event.status === "LIVE" ? "the hunt is live" : "the hunt starts soon"}
        </p>
      )}
      {data && data.event.revealed ? <Results rows={data.rows} fg={fg} /> : data && <Progress rows={data.rows} fg={fg} showScores={data.event.showScores} />}

      <div style={{ marginTop: "auto" }}>
        <Marquee invert={dark} />
      </div>
    </div>
  );
}

function Slots({ cleared, current, fg }: { cleared: number; current: number; fg: string }) {
  return (
    <span style={{ display: "inline-grid", gridTemplateColumns: "repeat(8, 1.5em)", gap: "0.25em" }} aria-label={`${cleared} of 8`}>
      {Array.from({ length: 8 }, (_, i) => (
        <span
          key={i}
          style={{
            height: "1.1em",
            border: `1.5px solid ${fg}`,
            background: i + 1 <= cleared ? fg : i + 1 === current ? "var(--color-tape)" : "transparent",
          }}
        />
      ))}
    </span>
  );
}

function Progress({ rows, fg, showScores }: { rows: Row[]; fg: string; showScores: boolean }) {
  return (
    <div style={{ padding: "0 2.5vw", columnCount: rows.length > 14 ? 2 : 1, columnGap: "3vw" }}>
      {rows.map((r) => (
        <div
          key={r.id}
          style={{
            breakInside: "avoid",
            display: "grid",
            gridTemplateColumns: "2.4em 1fr auto 4em 4.5em 7em",
            alignItems: "center",
            gap: "0.8em",
            padding: "0.45em 0.6em",
            borderBottom: `1px solid ${fg}`,
            borderLeft: r.finished ? "8px solid var(--color-signal)" : "8px solid transparent",
          }}
        >
          <span className="t-mono tabular" style={{ fontWeight: 600 }}>
            {String(r.position).padStart(2, "0")}
          </span>
          <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
          <Slots cleared={r.cleared} current={r.current} fg={fg} />
          <span className="t-mono">{r.finished ? "DONE" : `CP${String(r.current).padStart(2, "0")}`}</span>
          <span className="t-mono tabular">{r.finished ? mmss(r.elapsedMs) : showScores && r.total !== null ? r.total : ""}</span>
          <span className="t-meta" style={{ fontSize: "0.7em" }}>
            {r.status === "DISQUALIFIED" ? "DQ" : r.finished ? "TREASURE CLAIMED" : "ON THE HUNT"}
          </span>
        </div>
      ))}
    </div>
  );
}

function Results({ rows, fg }: { rows: Row[]; fg: string }) {
  const top = rows.filter((r) => r.rank !== null && r.rank <= 3).slice(0, 3);
  const rest = rows.filter((r) => !top.includes(r));
  return (
    <div style={{ padding: "0 2.5vw", display: "grid", gridTemplateColumns: "3fr 2fr", gap: "3vw" }}>
      <div style={{ display: "grid", gap: "1.2vh" }}>
        {top.map((r) => (
          <div key={r.id} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "end", gap: "1.5vw", borderBottom: `2px solid ${fg}`, paddingBottom: "1vh" }}>
            <span className="t-numeral" style={{ fontSize: r.rank === 1 ? "clamp(90px, 13vw, 240px)" : "clamp(70px, 9vw, 170px)", color: r.rank === 1 ? "var(--color-signal)" : fg }}>
              {r.rank}
            </span>
            <span className="t-display" style={{ fontSize: r.rank === 1 ? "clamp(32px, 4vw, 80px)" : "clamp(24px, 3vw, 56px)" }}>
              {r.name}
            </span>
            <span className="t-mono tabular" style={{ fontSize: "2.2em", fontWeight: 600 }}>
              {r.total}
            </span>
          </div>
        ))}
      </div>
      <div>
        {rest.map((r) => (
          <div key={r.id} style={{ display: "grid", gridTemplateColumns: "2.5em 1fr auto", gap: "0.8em", padding: "0.35em 0", borderBottom: `1px solid ${fg}` }}>
            <span className="t-mono">{r.rank ?? "—"}</span>
            <span>{r.name}</span>
            <span className="t-mono tabular">{r.total ?? ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
