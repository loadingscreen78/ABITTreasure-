"use client";
import { useState } from "react";
import { IconLock } from "@/components/ui/icons";
import { ErrorLine, Strip } from "@/components/ui/kit";
import { api } from "@/lib/client/api";
import type { HintLevel, QuestionView, TeamView } from "@/lib/types";

const LABEL: Record<HintLevel, string> = { low: "Low", medium: "Medium", high: "High" };

/** Paid hints for the current question, bought with hint-wallet points (separate from the score). */
export function HintShop({ q, wallet, onView }: { q: QuestionView; wallet: number; onView: (v: TeamView) => void }) {
  const [busy, setBusy] = useState<HintLevel | null>(null);
  const [confirmLevel, setConfirmLevel] = useState<HintLevel | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (!q.hints.length) return null;

  const buy = async (level: HintLevel) => {
    setBusy(level);
    setErr(null);
    const r = await api<{ text: string; view: TeamView }>("/api/team/buy-hint", { body: { questionId: q.id, level } });
    setBusy(null);
    setConfirmLevel(null);
    if (r.ok) return onView(r.view);
    setErr(r.message);
    if (r.view) onView(r.view as TeamView);
  };

  return (
    <section className="card-flat" style={{ marginTop: 22, padding: "12px 14px" }} aria-labelledby="hint-shop">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <span id="hint-shop" className="t-meta">
          Buy a hint
        </span>
        <span className="t-meta tabular" aria-label={`Hint wallet ${wallet} points`}>
          Wallet · <strong>{wallet}</strong> pts
        </span>
      </div>
      <p style={{ margin: "6px 0 10px", fontSize: 14, color: "var(--color-graphite)" }}>Hint points don&apos;t affect your score. You earned them on the first three questions.</p>
      <div style={{ display: "grid", gap: 8 }}>
        {q.hints.map((h) => {
          if (h.bought)
            return (
              <div key={h.level} className="strip strip-note anim-slide" style={{ padding: "10px 12px" }}>
                <span className="t-meta" style={{ display: "block", marginBottom: 4 }}>
                  {LABEL[h.level]} hint
                </span>
                {h.text}
              </div>
            );
          const short = wallet < h.cost;
          const confirming = confirmLevel === h.level;
          return (
            <button
              key={h.level}
              type="button"
              className={`btn ${confirming ? "btn-ink" : "btn-paper"}`}
              style={{ minHeight: 52, fontSize: 13 }}
              disabled={short || busy !== null}
              onClick={() => (confirming ? void buy(h.level) : setConfirmLevel(h.level))}
              aria-label={confirming ? `Confirm: spend ${h.cost} points on the ${h.level} hint` : `${LABEL[h.level]} hint, ${h.cost} points`}
            >
              <span>
                {busy === h.level ? "Buying…" : confirming ? `Tap again to spend ${h.cost} pts` : `${LABEL[h.level]} hint`}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {short && <IconLock size={14} />}
                {h.cost} pts
              </span>
            </button>
          );
        })}
      </div>
      {err && (
        <div style={{ marginTop: 10 }}>
          <Strip tone="error" live>
            <ErrorLine>{err}</ErrorLine>
          </Strip>
        </div>
      )}
    </section>
  );
}
