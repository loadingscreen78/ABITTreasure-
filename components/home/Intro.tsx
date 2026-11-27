"use client";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { SplitFlap } from "./fx";
import { Score } from "@/lib/client/score";

/**
 * Opening film — the INAUGURAL CODE2CAREER welcome (Est. 2026).
 * A ceremonial ~27 s sequence: institute presents → "Welcome to the inaugural edition" →
 * CODE2CAREER → Established 2026 seal → lighting of the lamp (Tamaso Mā Jyotirgamaya) →
 * Event 01: Tech Treasure Hunt → inaugurated. JS sequences scenes (skip / replay / sound);
 * motion is CSS (transform / opacity). Plays once per session, never for reduced motion.
 */
const v = (o: Record<string, string | number>) => o as CSSProperties;
const SKIP_CSS =
  ".cover{display:none!important}.stage{animation-delay:calc(var(--d,0)*1ms)!important}.hero-watermark,.seal{animation-delay:.3s!important}";
type W = Window & { __tthSeen?: number; __tthOpen?: number };

function markClosed() {
  const w = window as W;
  w.__tthSeen = 1;
  w.__tthOpen = 0;
  document.getElementById("tth-hold")?.remove();
  if (!document.getElementById("tth-seen")) document.head.insertAdjacentHTML("beforeend", `<style id="tth-seen">${SKIP_CSS}</style>`);
  try {
    sessionStorage.setItem("tth-intro", "1");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event("tth-intro-done"));
}

function Logo({ size, t = 0 }: { size: number; t?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="cv-pop" src="/brand/abit-logo.webp" alt="" width={size} height={size} style={v({ width: size, height: size, display: "block", "--t": `${t}ms` })} />
  );
}

/** Rotating ceremonial seal: ESTABLISHED 2026. */
function EstSeal() {
  const ring = "CODE2CAREER • INAUGURAL EDITION • ESTABLISHED 2026 • ABIT CUTTACK • ";
  return (
    <div className="inaug-seal cv-pop" style={v({ "--t": "150ms" })} aria-hidden>
      <svg viewBox="0 0 200 200" className="inaug-ring">
        <defs>
          <path id="inaug-circle" d="M100,100 m-80,0 a80,80 0 1,1 160,0 a80,80 0 1,1 -160,0" />
        </defs>
        <circle cx="100" cy="100" r="97" fill="none" stroke="#F2EDE3" strokeWidth="2" />
        <circle cx="100" cy="100" r="64" fill="none" stroke="#F2EDE3" strokeWidth="1.5" strokeDasharray="3 4" />
        <text fontFamily="var(--font-mono)" fontSize="11.5" fontWeight="600" fill="#F2EDE3">
          <textPath href="#inaug-circle" textLength="498" lengthAdjust="spacing">
            {ring}
          </textPath>
        </text>
      </svg>
      <div className="inaug-core">
        <span className="cv-k" style={{ color: "#F2EDE3" }}>
          Est.
        </span>
        <span className="inaug-year">2026</span>
      </div>
    </div>
  );
}

/** The ceremonial lamp (diya). The flame ignites, then flickers; rays turn slowly. */
function Diya() {
  return (
    <svg className="diya" viewBox="0 0 240 200" aria-hidden>
      <g className="diya-rays">
        {Array.from({ length: 16 }, (_, k) => {
          const a = (k / 16) * Math.PI * 2;
          const r1 = 52;
          const r2 = k % 2 ? 70 : 82;
          return (
            <line key={k} x1={120 + Math.cos(a) * r1} y1={74 + Math.sin(a) * r1} x2={120 + Math.cos(a) * r2} y2={74 + Math.sin(a) * r2} stroke="#F2C230" strokeWidth="3" strokeLinecap="square" />
          );
        })}
      </g>
      <g className="diya-flame">
        <path d="M120 24 C 136 50, 140 66, 132 80 C 127 89, 113 89, 108 80 C 100 66, 106 48, 120 24 Z" fill="#FF5A1F" />
        <path d="M120 46 C 128 60, 130 70, 125 78 C 122 83, 118 83, 115 78 C 110 70, 113 60, 120 46 Z" fill="#F2C230" />
      </g>
      <path d="M118 88 h4 v10 h-4 z" fill="#F2EDE3" />
      <path d="M52 112 C 70 160, 170 160, 188 112 L 204 106 L 196 122 C 176 176, 64 176, 44 122 L 36 106 Z" fill="#F2C230" stroke="#121212" strokeWidth="3" />
      <path d="M44 112 H 196" stroke="#121212" strokeWidth="3" />
      <path d="M90 168 h60 l8 14 h-76 z" fill="#FF5A1F" stroke="#121212" strokeWidth="3" />
    </svg>
  );
}

interface Scene {
  id: string;
  ms: number;
  say: string;
  render: () => ReactNode;
}

const SCENES: Scene[] = [
  { id: "gate", ms: 6500, say: "The inaugural CODE2CAREER. Tap to begin with sound, or continue without sound.", render: () => null },
  {
    id: "presents",
    ms: 3400,
    say: "Ajay Binay Institute of Technology, Department of Computer Science, presents.",
    render: () => (
      <div className="cv-scene" style={{ textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Logo size={136} />
        </div>
        <div className="cv-k cv-a" style={v({ "--t": "500ms", marginTop: 20 })}>
          Ajay Binay Institute of Technology (Autonomous), Cuttack
        </div>
        <div className="cv-h" style={{ fontSize: "clamp(24px, 6.6vw, 52px)" }}>
          <span className="cv-type" style={v({ "--t": "900ms", "--dur": "900ms" })}>
            Department of Computer Science
          </span>
        </div>
        <div className="cv-k cv-a" style={v({ "--t": "1900ms", marginTop: 16, letterSpacing: "0.7em", color: "#F2EDE3" })}>
          proudly presents
        </div>
      </div>
    ),
  },
  {
    id: "welcome",
    ms: 3400,
    say: "Welcome to the inaugural edition of",
    render: () => (
      <div className="cv-scene" style={{ textAlign: "center" }}>
        <div className="cv-k cv-a" style={v({ "--t": "100ms", fontSize: "clamp(12px, 3.4vw, 18px)", letterSpacing: "0.4em" })}>
          Welcome to the
        </div>
        <div className="cv-shake" style={v({ "--t": "820ms", marginTop: 14 })}>
          <span className="cv-slam" style={v({ "--t": "450ms" })}>
            <span className="inaug-word">Inaugural</span>
          </span>
        </div>
        <div className="cv-k cv-a" style={v({ "--t": "1500ms", marginTop: 18, fontSize: "clamp(12px, 3.4vw, 18px)", letterSpacing: "0.4em" })}>
          edition of
        </div>
      </div>
    ),
  },
  {
    id: "series",
    ms: 3800,
    say: "CODE2CAREER. From code to career.",
    render: () => (
      <div className="cv-scene" style={{ textAlign: "center" }}>
        <h2 className="cv-h" style={{ fontSize: "clamp(28px, min(8.4vw, 12vh), 132px)", margin: 0, whiteSpace: "nowrap" }} aria-label="CODE2CAREER">
          {Array.from("CODE2CAREER").map((ch, k) => (
            <span key={k} className="cv-slam" style={v({ "--t": `${120 + k * 95}ms`, display: "inline-block", color: ch === "2" ? "#FF5A1F" : "inherit" })}>
              {ch}
            </span>
          ))}
        </h2>
        <div className="cv-a" style={v({ "--t": "1350ms", marginTop: 22 })}>
          <span className="cv-tape" style={v({ "--t": "1350ms", fontSize: "clamp(12px, 3.2vw, 16px)" })}>
            From code · to career
          </span>
        </div>
        <p className="cv-sub cv-a" style={v({ "--t": "1900ms" })}>
          A new series by the Department of Computer Science — built by students, for students.
        </p>
      </div>
    ),
  },
  {
    id: "est",
    ms: 3600,
    say: "Established 2026. Edition 01.",
    render: () => (
      <div className="cv-scene" style={{ textAlign: "center" }}>
        <EstSeal />
        <div style={{ marginTop: 22 }}>
          <span className="cv-stamp" style={v({ "--t": "1100ms", color: "#FF5A1F", fontSize: "clamp(26px, 8vw, 56px)", transform: "rotate(-6deg)" })}>
            Edition 01
          </span>
        </div>
        <div className="cv-k cv-a" style={v({ "--t": "1700ms", marginTop: 16 })}>
          The first of many · Established 2026
        </div>
      </div>
    ),
  },
  {
    id: "lamp",
    ms: 4400,
    say: "Lighting of the lamp. Tamaso Ma Jyotirgamaya: lead me from darkness to light.",
    render: () => (
      <div className="cv-scene" style={{ textAlign: "center" }}>
        <div className="cv-k cv-a" style={v({ "--t": "100ms" })}>
          Lighting of the lamp
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
          <Diya />
        </div>
        <div className="t-riddle cv-a" style={v({ "--t": "1500ms", fontSize: "clamp(22px, 6vw, 40px)", marginTop: 6 })}>
          Tamaso Mā Jyotirgamaya
        </div>
        <div className="cv-k cv-a" style={v({ "--t": "2100ms", marginTop: 10 })}>
          Lead me from darkness to light
        </div>
      </div>
    ),
  },
  {
    id: "event",
    ms: 3800,
    say: "Event zero one: the Tech Treasure Hunt. Decode, discover, win.",
    render: () => (
      <div className="cv-scene">
        <div className="cv-k cv-a" style={v({ "--t": "0ms" })}>
          Event 01 · Inaugural edition
        </div>
        <div className="cv-shake" style={v({ "--t": "1080ms", marginTop: 10 })}>
          <h2 className="cv-h" style={{ fontSize: "clamp(40px, min(11.4vw, 12vh), 136px)", margin: 0 }}>
            <span className="cv-slam" style={v({ "--t": "300ms" })}>
              Tech
            </span>
            <span className="cv-slam" style={v({ "--t": "680ms" })}>
              <span style={{ background: "#FF5A1F", color: "#121212", padding: "0 0.06em" }}>Treasure</span>
            </span>
            <span className="cv-slam" style={v({ "--t": "1060ms" })}>
              Hunt
            </span>
          </h2>
        </div>
        <div className="cv-a" style={v({ "--t": "1700ms", marginTop: 22 })}>
          <SplitFlap words={["DECODE", "DISCOVER", "WIN!"]} every={650} />
        </div>
      </div>
    ),
  },
  {
    id: "open",
    ms: 6000,
    say: "Inaugurated. Welcome, second-years. Enter, or register your team.",
    render: () => null, // rendered by the component (needs close handlers)
  },
];

export function IntroFilm() {
  const [open, setOpen] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [i, setI] = useState(0);
  const [js, setJs] = useState(false);
  const closing = useRef(false);
  const score = useRef<Score | null>(null);
  const [sound, setSound] = useState(false);

  const enableSound = useCallback(() => {
    // must run inside a tap/click (browser autoplay rules)
    if (!score.current) score.current = Score.create();
    score.current?.start();
    score.current?.setMuted(false);
    setSound(true);
    try {
      localStorage.setItem("tth-sound", "1");
    } catch {
      /* ignore */
    }
  }, []);
  const toggleSound = useCallback(() => {
    if (!score.current || !sound) {
      enableSound();
      return;
    }
    score.current.setMuted(true);
    setSound(false);
    try {
      localStorage.setItem("tth-sound", "0");
    } catch {
      /* ignore */
    }
  }, [sound, enableSound]);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    setLeaving(true);
    score.current?.stop(1.2);
    score.current = null;
    setSound(false);
    markClosed();
    setTimeout(() => {
      setOpen(false);
      setLeaving(false);
      closing.current = false;
    }, 650);
  }, []);

  // first mount: skip if already seen this session / reduced motion
  useEffect(() => {
    const id = setTimeout(() => {
      const w = window as W;
      setJs(true);
      if (w.__tthSeen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) setOpen(false);
    }, 0);
    const replay = () => {
      document.getElementById("tth-seen")?.remove();
      (window as W).__tthOpen = 1;
      closing.current = false;
      let wantsSound = false;
      try {
        wantsSound = localStorage.getItem("tth-sound") === "1";
      } catch {
        /* ignore */
      }
      if (wantsSound) {
        score.current = Score.create();
        score.current?.start();
        setSound(!!score.current);
      }
      setI(wantsSound ? 1 : 0);
      setLeaving(false);
      setOpen(true);
    };
    window.addEventListener("tth-replay", replay);
    return () => {
      clearTimeout(id);
      window.removeEventListener("tth-replay", replay);
    };
  }, []);

  // scene clock
  useEffect(() => {
    if (!open || !js || leaving) return;
    const s = SCENES[i];
    if (!s) return;
    const id = setTimeout(() => (i < SCENES.length - 1 ? setI(i + 1) : close()), s.ms);
    return () => clearTimeout(id);
  }, [i, open, js, leaving, close]);

  // soundtrack cues, in step with each scene's animation
  useEffect(() => {
    if (!open || leaving) return;
    const s = SCENES[i];
    if (s && score.current && sound) score.current.cue(s.id);
  }, [i, open, leaving, sound]);

  // keyboard: Esc / Enter skip
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, close]);

  if (!open) return null;
  const s = SCENES[i]!;
  return (
    <div className={`cover cv${js ? "" : " cv-css"}${leaving ? " is-leaving" : ""}`} role="dialog" aria-modal="true" aria-label="Welcome briefing: the inaugural CODE2CAREER, established 2026">
      <noscript>
        <style>{".cover{display:none!important}"}</style>
      </noscript>
      <div className="cv-top">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/abit-logo.webp" alt="ABIT" width={30} height={30} style={{ width: 30, height: 30 }} />
          <span className="cv-k">Inaugural · Est. 2026</span>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
        <button type="button" className="cv-skip" style={{ minHeight: 40, padding: "0 10px", display: "inline-flex", alignItems: "center", gap: 6 }} onClick={toggleSound} aria-pressed={sound} aria-label={sound ? "Mute music" : "Play music"}>
          <Speaker on={sound} /> Sound
        </button>
        <button type="button" className="cv-skip" style={{ minHeight: 40, padding: "0 12px" }} onClick={close}>
          Skip <span aria-hidden>→</span>
        </button>
        </span>
      </div>

      <div className="cv-stage">
        <span className="sr-only" aria-live="polite">
          {s.say}
        </span>
        <div key={`${s.id}-${i}`} style={{ width: "100%", display: "grid", placeItems: "center" }}>
          {s.id === "gate" ? (
            <div className="cv-scene" style={{ textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <Logo size={88} />
              </div>
              <div className="cv-k cv-a" style={v({ "--t": "200ms", marginTop: 16 })}>
                Department of Computer Science · ABIT Cuttack
              </div>
              <div className="cv-h cv-a" style={v({ "--t": "300ms", fontSize: "clamp(36px, 11vw, 84px)" })}>
                Code<span style={{ color: "#FF5A1F" }}>2</span>Career
              </div>
              <div style={{ margin: "16px 0 6px" }}>
                <span className="cv-stamp" style={v({ "--t": "550ms", color: "#FF5A1F", fontSize: "clamp(20px, 6vw, 40px)", transform: "rotate(-6deg)" })}>
                  Inaugural · Est. 2026
                </span>
              </div>
              <div className="cv-cta cv-a" style={v({ "--t": "700ms", justifyContent: "center", flexDirection: "column", alignItems: "stretch", maxWidth: 420, margin: "26px auto 0" })}>
                <button
                  type="button"
                  className="btn btn-paper"
                  style={{ flex: "none" }}
                  onClick={() => {
                    enableSound();
                    setI(1);
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                    <Speaker on /> Begin · sound on
                  </span>
                  <span aria-hidden>▸</span>
                </button>
                <button type="button" className="cv-skip" style={{ alignSelf: "center", flex: "none" }} onClick={() => setI(1)}>
                  Begin without sound
                </button>
              </div>
              <p className="cv-k cv-a" style={v({ "--t": "1200ms", marginTop: 16, opacity: 0.7 })}>
                Speaker up · the ceremony begins by itself in a moment
              </p>
            </div>
          ) : s.id === "open" ? (
            <div className="cv-scene" style={{ textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <Logo size={96} />
              </div>
              <div style={{ marginTop: 18 }}>
                <span className="cv-stamp" style={v({ "--t": "300ms", color: "#FF5A1F", fontSize: "clamp(32px, 10vw, 72px)", transform: "rotate(-6deg)" })}>
                  Inaugurated
                </span>
              </div>
              <div className="cv-k cv-a" style={v({ "--t": "700ms", marginTop: 14 })}>
                CODE2CAREER · Edition 01 · Est. 2026
              </div>
              <p className="cv-sub cv-a" style={v({ "--t": "1000ms", fontSize: "clamp(20px, 5.4vw, 30px)", fontWeight: 600, color: "#F2EDE3" })}>
                Welcome, 2nd-years. Let the hunt begin.
              </p>
              <div className="cv-cta cv-a" style={v({ "--t": "1400ms", justifyContent: "center" })}>
                <button className="btn btn-paper" onClick={close} type="button">
                  Enter <span aria-hidden>→</span>
                </button>
                <a
                  className="btn btn-ink"
                  href="#register"
                  style={{ border: "1.5px solid #F2EDE3" }}
                  onClick={() => {
                    close();
                  }}
                >
                  Register your team <span aria-hidden>↓</span>
                </a>
              </div>
            </div>
          ) : (
            s.render()
          )}
        </div>
      </div>

    </div>
  );
}

function Speaker({ on }: { on: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="square" aria-hidden>
      <path d="M4 9h4l5-4v14l-5-4H4z" />
      {on ? <path d="M16 9c1.3 1.6 1.3 4.4 0 6M18.5 6.5c2.8 3.2 2.8 7.8 0 11" /> : <path d="M16 9l5 6M21 9l-5 6" />}
    </svg>
  );
}

/** Small button on the page to watch the briefing again. */
export function ReplayButton() {
  return (
    <button type="button" className="replay-btn" onClick={() => window.dispatchEvent(new Event("tth-replay"))}>
      ▸ Replay the opening
    </button>
  );
}
