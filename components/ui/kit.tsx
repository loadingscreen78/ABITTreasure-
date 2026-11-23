import type { ReactNode } from "react";
import { cpLabel } from "@/lib/game/format";
import { IconCheck, IconCross } from "./icons";

/** 8-slot punch card — the signature element. */
export function PunchCard({ cleared, current, total = 8, punching }: { cleared: number; current: number; total?: number; punching?: number | null }) {
  return (
    <div className="punch" role="img" aria-label={`${cleared} of ${total} checkpoints cleared`}>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const done = n <= cleared;
        const cur = !done && n === current;
        return <span key={n} className={`punch-slot${done ? " is-done" : ""}${cur ? " is-current" : ""}${punching === n ? " is-punching" : ""}`} />;
      })}
    </div>
  );
}

export function CodeBlock({ code }: { code: string }) {
  const lines = code.split("\n");
  return (
    <div className="code-block" role="figure" aria-label="Code">
      <div className="gutter" aria-hidden>
        {lines.map((_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <pre tabIndex={0}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function Stamp({ children, tone = "verified", animate = false, size = 26 }: { children: ReactNode; tone?: "verified" | "error"; animate?: boolean; size?: number }) {
  return (
    <span className={`stamp stamp-${tone}${animate ? " anim-stamp" : ""}`} style={{ fontSize: size }}>
      {children}
    </span>
  );
}

export function ArrivedChip({ label, marks }: { label: string; marks: number | null }) {
  return (
    <span className="chip t-meta" style={{ color: "var(--color-verified)", background: "var(--color-card)", fontSize: 12 }}>
      <IconCheck size={14} /> ARRIVED · {label.toUpperCase()}
      {marks !== null && <strong style={{ marginLeft: 6 }}>{marks > 0 ? `+${marks}` : "+0"}</strong>}
    </span>
  );
}

export function CpNumeral({ order }: { order: number }) {
  return (
    <div className="t-numeral" aria-label={`Checkpoint ${order}`}>
      {cpLabel(order)}
    </div>
  );
}

export function QuestionCard({ clue, title, children }: { clue: number; title: string; children: ReactNode }) {
  return (
    <section className="card" style={{ padding: 0 }}>
      <div className="t-meta" style={{ borderBottom: "1.5px solid var(--color-ink)", padding: "8px 14px", display: "flex", gap: 8 }}>
        <span>[ Q·{String(clue).padStart(2, "0")}</span>
        <span aria-hidden>{"//"}</span>
        <span>{title} ]</span>
      </div>
      <div style={{ padding: "14px" }}>{children}</div>
    </section>
  );
}

export function Strip({ tone, children, live = false }: { tone: "error" | "ok" | "note" | "ink" | "signal"; children: ReactNode; live?: boolean }) {
  return (
    <div className={`strip strip-${tone} anim-slide`} role={live ? "status" : undefined} aria-live={live ? "polite" : undefined}>
      {children}
    </div>
  );
}

export function ErrorLine({ children }: { children: ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "flex-start", gap: 8 }}>
      <IconCross size={18} style={{ flex: "none", marginTop: 2 }} />
      <span>{children}</span>
    </span>
  );
}

export function MetaRow({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div className="t-meta" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 0 10px" }}>
      <span>{left}</span>
      {right !== undefined && <span>{right}</span>}
    </div>
  );
}
