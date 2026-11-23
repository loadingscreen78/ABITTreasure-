"use client";
import { useState } from "react";
import { IconCamera, IconCheck, IconPin } from "@/components/ui/icons";
import { Stamp, Strip } from "@/components/ui/kit";
import { DecryptText, useNow } from "@/components/ui/live";
import { api } from "@/lib/client/api";
import { cpLabel } from "@/lib/game/format";
import type { Banner, TeamView } from "@/lib/types";
import { BannerStrip } from "./Banner";
import type { Flash } from "./TeamApp";

type CView = Extract<TeamView, { kind: "clue" }>;

export function CluePanel({ view, flash }: { view: CView; flash: Flash | null }) {
  const c = view.clue;
  const now = useNow(1000);
  const fresh = !!flash && now - flash.at < 8000 && !view.banner;
  const [nudge, setNudge] = useState<string | null>(c.nudge);
  const [open, setOpen] = useState(!!c.nudge);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tip, setTip] = useState(false);

  const toggleNudge = async () => {
    if (open) return setOpen(false);
    setOpen(true);
    if (nudge || c.clue === null) return;
    setLoading(true);
    const r = await api<{ nudge: string }>("/api/team/hint", { body: { clue: c.clue } });
    setLoading(false);
    if (r.ok) setNudge(r.nudge);
    else setErr(r.message);
  };

  return (
    <div>
      <BannerStrip banner={view.banner} />
      {fresh && (
        <div style={{ margin: "22px 0 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }} role="status">
          <Stamp animate size={30}>
            Verified
          </Stamp>
          <span className="t-meta" style={{ color: "var(--color-verified)" }}>
            <IconCheck size={14} style={{ verticalAlign: "-2px" }} /> Verified — {flash!.marks > 0 ? `+${flash!.marks}` : "clue unlocked"}
          </span>
        </div>
      )}

      <section className="card" style={{ marginTop: 22, position: "relative", padding: "26px 16px 14px" }} aria-labelledby="clue-meta">
        <span className="tape t-meta" style={{ position: "absolute", top: -12, left: 14, fontSize: 11 }}>
          {c.clue !== null ? `Clue ${String(c.clue).padStart(2, "0")} · ${c.title}` : c.title}
        </span>
        <p id="clue-meta" className="t-meta" style={{ margin: "0 0 10px", color: "var(--color-graphite)" }}>
          Next location · Decrypted
        </p>
        <p className="t-riddle" style={{ margin: 0 }}>
          &ldquo;<DecryptText text={c.riddle} run={fresh} />&rdquo;
        </p>
        {c.hasNudge && (
          <>
            <div className="perf" style={{ margin: "16px -16px 10px" }} aria-hidden />
            <button
              type="button"
              onClick={toggleNudge}
              aria-expanded={open}
              aria-controls="nudge"
              className="t-meta"
              style={{ background: "none", border: 0, padding: "12px 0", minHeight: 48, display: "flex", alignItems: "center", gap: 8 }}
            >
              <span aria-hidden style={{ display: "inline-block", transform: open ? "rotate(90deg)" : "none", transition: "transform 160ms" }}>
                ▸
              </span>
              Need a nudge?
            </button>
            {open && (
              <div id="nudge" className="anim-slide" style={{ paddingBottom: 6 }}>
                {loading ? <span className="t-meta anim-blink">Fetching…</span> : nudge ? <p style={{ margin: 0 }}>{nudge}</p> : <p style={{ margin: 0 }}>{err}</p>}
              </div>
            )}
          </>
        )}
      </section>

      <p style={{ margin: "22px 0 14px", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
        <IconPin size={18} /> Go there. Find the QR for {cpLabel(c.nextOrder)}.
      </p>
      <button className="btn btn-ink" type="button" onClick={() => setTip((t) => !t)} aria-expanded={tip}>
        I&apos;m at the next QR — open camera <IconCamera />
      </button>
      {tip && (
        <div style={{ marginTop: 14 }}>
          <Strip tone="note">
            Open your phone&apos;s <strong>camera app</strong> and point it at the QR card. It opens this page and unlocks the checkpoint automatically.
          </Strip>
        </div>
      )}
    </div>
  );
}

export function StartPanel({ banner }: { banner: Banner }) {
  return (
    <div>
      <BannerStrip banner={banner} />
      <div className="t-numeral" style={{ marginTop: 20 }}>
        {cpLabel(1)}
      </div>
      <p style={{ margin: "14px 0 0", fontSize: 19, fontWeight: 600 }}>You&apos;re logged in.</p>
      <p style={{ margin: "8px 0 0" }}>Scan the {cpLabel(1)} QR at the registration desk to begin. Stay with your team.</p>
      <div style={{ marginTop: 18 }}>
        <Strip tone="note">
          <IconCamera size={18} style={{ verticalAlign: "-3px" }} /> Use your phone&apos;s camera app to scan each checkpoint card.
        </Strip>
      </div>
    </div>
  );
}
