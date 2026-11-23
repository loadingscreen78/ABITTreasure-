import { Footer, Marquee, Wordmark } from "@/components/ui/brand";
import { BRAND } from "@/lib/brand";
import { clockTime, mmss } from "@/lib/game/format";
import type { TeamView } from "@/lib/types";

type FView = Extract<TeamView, { kind: "finished" }>;

export function FinishPanel({ view }: { view: FView }) {
  return (
    <div style={{ background: "var(--color-ink)", color: "var(--color-paper)", minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <main className="sheet anim-rise" style={{ flex: 1, paddingTop: 16 }}>
        <div className="t-meta" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ filter: "invert(1)" }}>
            <Wordmark size="sm" />
          </span>
          <span>{BRAND.series}</span>
        </div>
        <hr className="rule-2" style={{ borderColor: "var(--color-paper)", margin: "12px 0 24px" }} />
        <h1 className="t-display" style={{ margin: 0, fontSize: "clamp(44px, 14vw, 64px)" }}>
          Treasure
          <br />
          Claimed
        </h1>
        <p className="t-meta" style={{ margin: "18px 0 0" }}>
          Team {view.header.id} · {view.header.name}
        </p>
        <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, margin: "22px 0 0" }}>
          <div style={{ borderTop: "1.5px solid var(--color-paper)", paddingTop: 8 }}>
            <dt className="t-meta">Finish time</dt>
            <dd className="t-mono tabular" style={{ margin: "4px 0 0", fontSize: 22 }}>
              {clockTime(view.finishedAt)}
            </dd>
          </div>
          <div style={{ borderTop: "1.5px solid var(--color-paper)", paddingTop: 8 }}>
            <dt className="t-meta">Elapsed</dt>
            <dd className="t-mono tabular" style={{ margin: "4px 0 0", fontSize: 22 }}>
              {mmss(view.elapsedMs)}
            </dd>
          </div>
        </dl>
        <div style={{ marginTop: 26, border: "1.5px solid var(--color-paper)", padding: "14px 16px", boxShadow: "4px 4px 0 0 var(--color-signal)" }}>
          <div className="t-meta">Judge verify code</div>
          <div className="t-mono tabular" style={{ fontSize: 56, fontWeight: 600, letterSpacing: "0.12em", lineHeight: 1.1 }} aria-label={`Judge code ${view.judgeCode ?? ""}`}>
            {view.judgeCode ?? "----"}
          </div>
        </div>
        <p style={{ margin: "22px 0 0", fontSize: 20, fontWeight: 600 }}>
          Say <span className="t-mono">{view.phrase ?? "the phrase"}</span> to the judge.
        </p>
        <Footer invert />
      </main>
      <Marquee invert />
    </div>
  );
}
