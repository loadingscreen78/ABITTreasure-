import type { ReactNode } from "react";
import { Footer, Wordmark } from "@/components/ui/brand";
import { RoughFilter } from "@/components/ui/icons";
import { PunchCard } from "@/components/ui/kit";
import { Timer } from "@/components/ui/live";
import type { TeamHeader } from "@/lib/types";

/** Mobile sheet with the meta bar, team line and punch-card progress. */
export function TeamShell({ header, skewMs, children, punching }: { header?: TeamHeader | null; skewMs: number; children: ReactNode; punching?: number | null }) {
  return (
    <main className="sheet anim-rise">
      <RoughFilter />
      <div className="t-meta" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0 10px" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Wordmark size="sm" />
          <span style={{ whiteSpace: "nowrap" }}>{header ? "CSE · CODE2CAREER" : "CODE2CAREER"}</span>
        </span>
        {header ? <Timer startedAt={header.startedAt} skewMs={skewMs} /> : <span style={{ whiteSpace: "nowrap" }}>Treasure hunt</span>}
      </div>
      <hr className="rule-2" />
      {header && (
        <div style={{ padding: "12px 0 4px" }}>
          <div className="t-meta" style={{ marginBottom: 8 }}>
            TEAM {header.id} · {header.name}
            {header.rehearsal && header.name.toLowerCase() !== "rehearsal" && <span style={{ color: "var(--color-signal-text)" }}> · REHEARSAL</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <PunchCard cleared={header.cleared} current={header.current} total={header.total} punching={punching} />
            </div>
            <span className="t-meta tabular" style={{ whiteSpace: "nowrap" }}>
              CP {String(header.current).padStart(2, "0")}/{String(header.total).padStart(2, "0")}
            </span>
          </div>
          <div className="t-meta tabular" style={{ marginTop: 8, color: "var(--color-graphite)" }}>
            Hint wallet · {header.wallet} pts
          </div>
        </div>
      )}
      <div style={{ minHeight: "calc(100dvh - 150px)" }}>{children}</div>
      <Footer />
    </main>
  );
}
