"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { mmss } from "@/lib/game/format";
import { IconClock } from "./icons";

/** Re-render every `ms` milliseconds. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

const motionQuery = "(prefers-reduced-motion: reduce)";
function subscribeMotion(cb: () => void) {
  const m = window.matchMedia(motionQuery);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(motionQuery).matches,
    () => false,
  );
}

/** Live elapsed timer from a server ISO start, corrected for clock skew. */
export function Timer({ startedAt, skewMs, stoppedAt }: { startedAt: string | null; skewMs: number; stoppedAt?: string | null }) {
  const now = useNow(1000);
  const start = startedAt ? new Date(startedAt).getTime() : null;
  const end = stoppedAt ? new Date(stoppedAt).getTime() : now + skewMs;
  const ms = start !== null ? Math.max(0, end - start) : null;
  return (
    <span className="tabular" style={{ display: "inline-flex", alignItems: "center", gap: 6 }} aria-label={`Elapsed ${mmss(ms)}`}>
      <IconClock size={14} />
      {mmss(ms)}
    </span>
  );
}

export function Countdown({ until, skewMs, onDone }: { until: string; skewMs: number; onDone?: () => void }) {
  const now = useNow(250);
  const left = new Date(until).getTime() - (now + skewMs);
  const done = left <= 0;
  useEffect(() => {
    if (done) onDone?.();
  }, [done, onDone]);
  return <span className="tabular">{mmss(Math.max(0, left + 999))}</span>;
}

const GLYPHS = "01<>/#%&";

/** Decrypt reveal: each character cycles through glyphs, settling left to right (~900 ms). */
export function DecryptText({ text, run }: { text: string; run: boolean }) {
  const reduced = useReducedMotion();
  const [frame, setFrame] = useState(run && !reduced ? 0 : -1);
  useEffect(() => {
    if (!run || reduced) return;
    const total = 900;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / total);
      setFrame(p >= 1 ? -1 : p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, reduced, text]);

  if (frame < 0) return <>{text}</>;
  const settled = Math.floor(frame * text.length * 1.15);
  const out = Array.from(text, (ch, i) => {
    if (ch === " " || i < settled) return ch;
    return GLYPHS[(i * 7 + Math.floor(frame * 60)) % GLYPHS.length];
  }).join("");
  return (
    <>
      <span aria-hidden>{out}</span>
      <span className="sr-only">{text}</span>
    </>
  );
}
