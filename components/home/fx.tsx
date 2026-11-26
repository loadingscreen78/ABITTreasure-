"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { usePublicStatus } from "./status";

const GLYPHS = "01<>/#%&";
const introSeen = () => typeof window !== "undefined" && !!(window as unknown as { __tthSeen?: number }).__tthSeen;
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Headline word that resolves from glyph noise, left to right. Waits for the intro film to close. */
export function Scramble({ text, delay = 0, duration = 720, immediate = false }: { text: string; delay?: number; duration?: number; immediate?: boolean }) {
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (reduced()) return;
    let raf = 0;
    const run = (wait: number) => {
      const start = performance.now() + wait;
      const tick = (t: number) => {
        const p = (t - start) / duration;
        if (p >= 1) return setOut(text);
        const settled = Math.max(0, Math.floor(p * text.length));
        setOut(Array.from(text, (ch, i) => (ch === " " || i < settled ? ch : GLYPHS[(i * 5 + Math.floor(t / 45)) % GLYPHS.length]!)).join(""));
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const w = window as unknown as { __tthOpen?: number };
    if (!immediate && w.__tthOpen) {
      const go = () => run(250 + delay * 0.12);
      window.addEventListener("tth-intro-done", go, { once: true });
      return () => {
        window.removeEventListener("tth-intro-done", go);
        cancelAnimationFrame(raf);
      };
    }
    run(immediate ? delay : introSeen() ? delay * 0.25 : delay);
    return () => cancelAnimationFrame(raf);
  }, [text, delay, duration, immediate]);
  return <span aria-hidden>{out}</span>;
}

/** Split-flap departure board cycling through words. */
export function SplitFlap({ words, width = 8, every = 2600 }: { words: string[]; width?: number; every?: number }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced()) return;
    const id = setInterval(() => setI((n) => (n + 1) % words.length), every);
    return () => clearInterval(id);
  }, [words.length, every]);
  const w = (words[i] ?? "").padEnd(width, " ").slice(0, width);
  return (
    <span className="flap-row" role="img" aria-label={words.join(", ")}>
      {Array.from(w, (ch, k) => (
        <span className="flap" key={k}>
          <span key={`${i}-${k}`} style={{ ["--i" as string]: k } as CSSProperties}>
            {ch === " " ? " " : ch}
          </span>
        </span>
      ))}
    </span>
  );
}

/** Live event status + teams-enlisted counter (public, content-free). */
export function LiveStatus() {
  const s = usePublicStatus();
  const [shown, setShown] = useState(0);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);
  useEffect(() => {
    const target = s?.enlisted ?? 0;
    if (!target) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 1100);
      setShown(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [s?.enlisted]);

  const st = s?.status ?? "DRAFT";
  const started = s?.startedAt ? new Date(s.startedAt).getTime() : null;
  const nowS = now + (s?.skew ?? 0);
  const label =
    st === "LIVE" && started && now && started > nowS
      ? `Starts in ${Math.ceil((started - nowS) / 1000)}s`
      : st === "LIVE"
        ? `Hunt live · ${started && now ? new Date(Math.max(0, nowS - started)).toISOString().slice(14, 19) : "--:--"}`
        : st === "PAUSED"
          ? "Hunt paused"
          : st === "ENDED"
            ? "Hunt closed"
            : "Standby · briefing soon";
  return (
    <span className="hero-meta">
      <span className="status-pill t-meta" role="status">
        <span className={`status-dot ${st === "LIVE" ? "is-live" : st === "DRAFT" ? "is-standby" : ""}`} aria-hidden />
        {label}
      </span>
      {s?.enlisted ? (
        <span className="t-meta tabular">
          <strong style={{ fontSize: 15 }}>{String(shown).padStart(2, "0")}</strong> teams enlisted
        </span>
      ) : null}
    </span>
  );
}

/** Adds .is-in when scrolled into view (one-shot). */
export function Reveal({ children, className = "", style, r = "0deg", r0 = "0deg", d = 0 }: { children: ReactNode; className?: string; style?: CSSProperties; r?: string; r0?: string; d?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced() || !("IntersectionObserver" in window)) {
      el.classList.add("is-in");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            el.classList.add("is-in");
            io.disconnect();
          }
      },
      { threshold: 0.18 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ ...style, ["--r" as string]: r, ["--r0" as string]: r0, ["--d" as string]: d }}>
      {children}
    </div>
  );
}

/** Mini-game: turn the Caesar dial until the intercepted line reads as English. */
const SECRET = "WELCOME AGENT";
const SHIFT = 3;
const shift = (s: string, k: number) => s.replace(/[A-Z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 65 + k + 26) % 26) + 65));
export function Cipher() {
  const [k, setK] = useState(0);
  const cipher = shift(SECRET, SHIFT);
  const plain = shift(cipher, -k);
  const solved = k === SHIFT;
  useEffect(() => {
    if (!solved) return;
    try {
      navigator.vibrate?.(30);
    } catch {
      /* ignore */
    }
  }, [solved]);
  return (
    <div>
      <div className="t-meta" style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <span>Intercepted transmission</span>
        <span className="tabular">Shift −{String(k).padStart(2, "0")}</span>
      </div>
      <div className={`cipher-tiles ${solved ? "granted" : ""}`} aria-live="polite" aria-label={solved ? `Decoded: ${plain}` : `Encoded: ${plain}`}>
        {Array.from(plain, (ch, i) =>
          ch === " " ? (
            <span key={i} className="gap" />
          ) : (
            <span className="flap" key={i}>
              <span key={`${k}-${i}`} style={{ ["--i" as string]: i } as CSSProperties}>
                {ch}
              </span>
            </span>
          ),
        )}
      </div>
      <div className="dial" style={{ marginTop: 16 }}>
        <button type="button" aria-label="Shift back" onClick={() => setK((n) => (n + 25) % 26)}>
          −
        </button>
        <div className="card-flat" style={{ display: "grid", placeItems: "center", textAlign: "center", padding: "6px 8px" }}>
          {solved ? (
            <span className="stamp stamp-verified anim-stamp" style={{ fontSize: 18 }}>
              Access granted
            </span>
          ) : (
            <span className="t-meta">Turn the dial until it reads like English</span>
          )}
        </div>
        <button type="button" aria-label="Shift forward" onClick={() => setK((n) => (n + 1) % 26)}>
          +
        </button>
      </div>
    </div>
  );
}
