"use client";
import { IconClock, IconLock } from "@/components/ui/icons";
import { Countdown } from "@/components/ui/live";
import type { TeamView } from "@/lib/types";

type GView = Extract<TeamView, { kind: "gate" }>;

export function GatePanel({ view, skewMs, onTick }: { view: GView; skewMs: number; onTick: () => void }) {
  if (view.gate === "NOT_STARTED")
    return (
      <div style={{ marginTop: 22 }}>
        <div className="t-display">Not started</div>
        <p style={{ margin: "14px 0 0", fontSize: 19 }}>
          The hunt hasn&apos;t started. Stay with your team.{" "}
          {view.startsAt ? (
            <>
              Starts in{" "}
              <strong className="t-mono">
                <Countdown until={view.startsAt} skewMs={skewMs} onDone={onTick} />
              </strong>
              .
            </>
          ) : (
            "Starts soon."
          )}
        </p>
        <p className="t-meta" style={{ marginTop: 18, display: "flex", gap: 8, alignItems: "center" }}>
          <IconClock size={14} /> This page updates by itself.
        </p>
      </div>
    );
  if (view.gate === "PAUSED")
    return (
      <div style={{ marginTop: 22 }}>
        <div className="t-display">Paused</div>
        <p style={{ margin: "14px 0 0", fontSize: 19 }}>The organisers have paused the hunt. Hold your position — this page resumes by itself.</p>
      </div>
    );
  if (view.gate === "TIMES_UP")
    return (
      <div className="strip strip-ink" style={{ marginTop: 22 }}>
        <div className="t-display">Time&apos;s up</div>
        <p style={{ margin: "12px 0 0", fontSize: 19 }}>Report to the finish desk.</p>
      </div>
    );
  return (
    <div className="strip strip-error" style={{ marginTop: 22 }}>
      <div className="t-display" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <IconLock size={34} /> Disqualified
      </div>
      <p style={{ margin: "12px 0 0", color: "var(--color-ink)" }}>Please report to the finish desk and speak to the organisers.</p>
    </div>
  );
}

export function MessagePanel({ title, text, onRetry }: { title: string; text: string; onRetry?: () => void }) {
  return (
    <div style={{ marginTop: 22 }}>
      <div className="t-display" style={{ fontSize: 40 }}>
        {title}
      </div>
      <p style={{ margin: "14px 0 0", fontSize: 18 }}>{text}</p>
      {onRetry && (
        <button className="btn btn-ink" style={{ marginTop: 20 }} onClick={onRetry}>
          Retry <span aria-hidden>→</span>
        </button>
      )}
    </div>
  );
}
