"use client";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { SplitFlap, Scramble } from "./fx";
import { LiveSetting } from "./status";
import { Score } from "@/lib/client/score";

/**
 * Opening film: an ~30-second animated briefing that explains the hunt, scene by scene.
 * JS sequences the scenes (so skip / replay / progress work); each scene's motion is CSS
 * (transform / opacity). Plays once per browser session, never for reduced motion.
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

function Decrypting() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - t0 - 200) / 1700));
      setPct(Math.round(p * 100));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="cv-scene" style={{ position: "relative" }}>
      <div className="cv-tape" style={v({ "--t": "150ms", fontSize: 12, display: "block", margin: "0 -24px 26px", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden" })}>
        Classified · ABIT · CODE2CAREER · Classified · ABIT · CODE2CAREER
      </div>
      <div className="cv-k">Case file TTH · Department of Computer Science</div>
      <div style={{ margin: "22px 0" }}>
        <span className="cv-stamp" style={v({ "--t": "550ms", color: "#FF5A1F", fontSize: "clamp(38px, 12vw, 84px)", transform: "rotate(-8deg)" })}>
          Classified
        </span>
      </div>
      <div className="cv-k tabular" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Decrypting dossier</span>
        <span>{String(pct).padStart(3, "0")}%</span>
      </div>
    </div>
  );
}

function Count({ to, ms = 1100, pad = 2, prefix = "" }: { to: number; ms?: number; pad?: number; prefix?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return (
    <>
      {prefix}
      {String(n).padStart(pad, "0")}
    </>
  );
}

const PINS: [number, number][] = [
  [40, 150],
  [86, 60],
  [168, 34],
  [256, 66],
  [292, 140],
  [214, 178],
  [134, 118],
  [62, 188],
];

interface Scene {
  id: string;
  ms: number;
  say: string;
  render: () => ReactNode;
}

const SCENES: Scene[] = [
  { id: "gate", ms: 6500, say: "Tap to open the case file with sound, or continue without sound.", render: () => null },
  { id: "decrypt", ms: 2600, say: "Classified case file. Decrypting.", render: () => <Decrypting /> },
  {
    id: "presents",
    ms: 3000,
    say: "Ajay Binay Institute of Technology, Department of Computer Science, presents.",
    render: () => (
      <div className="cv-scene" style={{ textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Logo size={128} />
        </div>
        <div className="cv-k cv-a" style={v({ "--t": "450ms", marginTop: 18 })}>
          Ajay Binay Institute of Technology (Autonomous), Cuttack
        </div>
        <div className="cv-h" style={{ fontSize: "clamp(26px, 7vw, 54px)" }}>
          <span className="cv-type" style={v({ "--t": "800ms", "--dur": "900ms" })}>
            Department of Computer Science
          </span>
        </div>
        <div className="cv-k cv-a" style={v({ "--t": "1700ms", marginTop: 14, letterSpacing: "0.6em", color: "#F2EDE3" })}>
          presents
        </div>
        <div style={{ marginTop: 18 }}>
          <span className="cv-tape" style={v({ "--t": "2100ms", fontSize: 14 })}>
            CODE2CAREER
          </span>
        </div>
      </div>
    ),
  },
  {
    id: "title",
    ms: 3400,
    say: "Tech Treasure Hunt. Decode, discover, win.",
    render: () => (
      <div className="cv-scene">
        <div className="cv-shake" style={v({ "--t": "980ms" })}>
          <h2 className="cv-h" style={{ fontSize: "clamp(40px, min(11.4vw, 12vh), 136px)", margin: 0 }}>
            <span className="cv-slam" style={v({ "--t": "100ms" })}>
              Tech
            </span>
            <span className="cv-slam" style={v({ "--t": "480ms" })}>
              <span style={{ background: "#FF5A1F", color: "#121212", padding: "0 0.06em" }}>Treasure</span>
            </span>
            <span className="cv-slam" style={v({ "--t": "860ms" })}>
              Hunt
            </span>
          </h2>
        </div>
        <div className="cv-a" style={v({ "--t": "1500ms", marginTop: 22 })}>
          <SplitFlap words={["DECODE", "DISCOVER", "WIN!"]} every={600} />
        </div>
      </div>
    ),
  },
  {
    id: "mission",
    ms: 3600,
    say: "Your mission: eight checkpoints are hidden across campus.",
    render: () => (
      <div className="cv-scene">
        <div className="cv-k">Your mission</div>
        <div className="cv-h">
          <span className="cv-type" style={v({ "--t": "100ms" })}>
            8 checkpoints.
          </span>
          <br />
          <span className="cv-type" style={v({ "--t": "600ms" })}>
            Hidden on campus.
          </span>
        </div>
        <svg viewBox="0 0 330 220" width="100%" style={{ display: "block", marginTop: 14, maxHeight: "34vh" }} aria-hidden>
          {PINS.slice(0, -1).map(([x, y], i) => {
            const [x2, y2] = PINS[i + 1]!;
            return <line key={i} className="route-seg" style={v({ "--i": i, animationDelay: `${900 + i * 170}ms` })} x1={x} y1={y} x2={x2} y2={y2} stroke="#F2EDE3" strokeWidth="2" strokeDasharray="5 5" />;
          })}
          {PINS.map(([x, y], i) => (
            <g key={i} className="route-pin" style={v({ "--i": i, animationDelay: `${820 + i * 170}ms` })}>
              <rect x={x - 12} y={y - 12} width="24" height="24" fill={i === 0 || i === 7 ? "#FF5A1F" : "#F2EDE3"} stroke="#F2EDE3" strokeWidth="1.5" />
              <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontFamily="var(--font-mono)" fontWeight="600" fill="#121212">
                {String(i + 1).padStart(2, "0")}
              </text>
            </g>
          ))}
        </svg>
        <div style={{ marginTop: 8 }}>
          <span className="cv-stamp" style={v({ "--t": "2400ms", color: "#FF5A1F", fontSize: 18, transform: "rotate(-4deg)" })}>
            Locations classified
          </span>
        </div>
      </div>
    ),
  },
  {
    id: "scan",
    ms: 3000,
    say: "Step one: scan. Point your phone camera at the checkpoint QR card.",
    render: () => (
      <div className="cv-scene">
        <div className="cv-step">
          <span className="no">01</span>
          <span className="cv-h" style={{ margin: 0 }}>
            Scan
          </span>
        </div>
        <div className="cv-vf">
          <i />
          <i />
          <i />
          <i />
          <svg viewBox="0 0 11 11" width="62%" style={{ position: "absolute", left: "19%", top: "19%" }} aria-hidden>
            {"11101011101101010101111011100010010111101010111010001000101011101110101110110101010111101".split("").map((c, k) =>
              c === "1" ? <rect key={k} x={k % 11} y={Math.floor(k / 11)} width="1" height="1" fill="#F2EDE3" /> : null,
            )}
          </svg>
          <span className="scan" />
        </div>
        <div className="cv-k cv-a" style={v({ "--t": "1300ms", marginTop: 16, color: "#FF5A1F", textAlign: "center" })}>
          Checkpoint detected · CP—01
        </div>
        <p className="cv-sub cv-a" style={v({ "--t": "1600ms", textAlign: "center" })}>
          Point your phone camera at the QR card, then log in with your Team ID.
        </p>
      </div>
    ),
  },
  {
    id: "solve",
    ms: 3600,
    say: "Step two: solve the tech question. A correct answer is verified and scores marks.",
    render: () => (
      <div className="cv-scene">
        <div className="cv-step">
          <span className="no">02</span>
          <span className="cv-h" style={{ margin: 0 }}>
            Solve
          </span>
        </div>
        <div className="cv-card cv-a" style={v({ "--t": "250ms", marginTop: 16, position: "relative" })}>
          <div className="t-meta" style={{ borderBottom: "1.5px solid #121212", padding: "8px 12px" }}>
            [ Q·?? // sample question ]
          </div>
          <div style={{ padding: "12px", fontSize: "clamp(16px, 4.6vw, 22px)" }}>How many bits make one byte?</div>
          <div style={{ padding: "0 12px 14px" }}>
            <div className="t-mono" style={{ fontSize: 24, borderBottom: "3px solid #121212", padding: "2px 0" }}>
              <span className="cv-type" style={v({ "--t": "900ms", "--dur": "300ms", "--bg": "#FBF8F2" })}>
                8
              </span>
            </div>
          </div>
          <span className="cv-stamp" style={v({ "--t": "1500ms", color: "#0E6B4C", fontSize: "clamp(24px, 7vw, 40px)", position: "absolute", right: 14, top: 40, background: "color-mix(in srgb, #FBF8F2 80%, transparent)", transform: "rotate(-8deg)" })}>
            Verified
          </span>
        </div>
        <p className="cv-sub cv-a" style={v({ "--t": "2000ms" })}>
          <strong style={{ color: "#FF5A1F" }}>+5 marks</strong> for each clue — full marks within <LiveSetting k="fullMarksWithinAttempts" fallback={3} /> tries.
        </p>
      </div>
    ),
  },
  {
    id: "decrypt-riddle",
    ms: 3400,
    say: "Step three: decrypt. Each correct answer reveals a riddle to the next place.",
    render: () => (
      <div className="cv-scene">
        <div className="cv-step">
          <span className="no">03</span>
          <span className="cv-h" style={{ margin: 0 }}>
            Decrypt
          </span>
        </div>
        <div className="cv-card cv-a" style={v({ "--t": "200ms", marginTop: 18, padding: "26px 16px 16px", position: "relative" })}>
          <span className="tape t-meta" style={{ position: "absolute", top: -12, left: 14 }}>
            Next location · sample
          </span>
          <p className="t-riddle" style={{ margin: 0, fontSize: "clamp(18px, 5vw, 28px)" }}>
            &ldquo;
            <Scramble text="I hum all day and glow on every desk. Find the room where I live." delay={500} duration={1300} immediate />
            &rdquo;
          </p>
        </div>
        <p className="cv-sub cv-a" style={v({ "--t": "2100ms" })}>
          A right answer decrypts the riddle to the next checkpoint — only for your team.
        </p>
      </div>
    ),
  },
  {
    id: "move",
    ms: 3200,
    say: "Step four: move. Walk to the next place, find its QR, and repeat eight times.",
    render: () => (
      <div className="cv-scene">
        <div className="cv-step">
          <span className="no">04</span>
          <span className="cv-h" style={{ margin: 0 }}>
            Move
          </span>
        </div>
        <div className="cv-punch" aria-hidden>
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} style={v({ "--i": i })}>
              <b style={v({ "--i": i })} />
            </span>
          ))}
        </div>
        <p className="cv-sub cv-a" style={v({ "--t": "2300ms" })}>
          Walk there, find the next QR, repeat. One punch per checkpoint — eight to finish.
        </p>
      </div>
    ),
  },
  {
    id: "numbers",
    ms: 3200,
    say: "Eight checkpoints, fifteen clues, one hundred marks, about twenty minutes.",
    render: () => (
      <div className="cv-scene">
        <div className="cv-k">The file in numbers</div>
        <div className="cv-nums">
          {[
            [8, "Checkpoints", ""],
            [15, "Clues", ""],
            [100, "Marks", ""],
            [20, "Minutes", "~"],
          ].map(([n, l, p], i) => (
            <div key={l as string} className="cv-a" style={v({ "--t": `${i * 160}ms` })}>
              <div className="n">
                <Count to={n as number} prefix={p as string} />
              </div>
              <div className="cv-k" style={{ marginTop: 6 }}>
                {l}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "rules",
    ms: 3400,
    say: "Teams of three or four. Stay together, play fair, no searching. The fastest perfect team takes the bonus.",
    render: () => (
      <div className="cv-scene">
        <div className="cv-k">Rules of engagement</div>
        {["Teams of 3–4 · stay together", "Follow the clue order", "No searching the internet", "Fastest perfect team wins the bonus"].map((r, i) => (
          <div key={r} className="cv-rule cv-a" style={v({ "--t": `${150 + i * 380}ms` })}>
            <span className="tick" aria-hidden>
              ✓
            </span>
            {r}
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "open",
    ms: 5200,
    say: "The file is open. Enter the hunt or register your team.",
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
    <div className={`cover cv${js ? "" : " cv-css"}${leaving ? " is-leaving" : ""}`} role="dialog" aria-modal="true" aria-label="Welcome briefing: how the Tech Treasure Hunt works">
      <noscript>
        <style>{".cover{display:none!important}"}</style>
      </noscript>
      <div className="cv-top">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/abit-logo.webp" alt="ABIT" width={30} height={30} style={{ width: 30, height: 30 }} />
          <span className="cv-k">Briefing</span>
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
                Case file TTH · Department of Computer Science · ABIT Cuttack
              </div>
              <div style={{ margin: "20px 0 6px" }}>
                <span className="cv-stamp" style={v({ "--t": "350ms", color: "#FF5A1F", fontSize: "clamp(32px, 10vw, 70px)", transform: "rotate(-6deg)" })}>
                  Classified
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
                    <Speaker on /> Open the file · sound on
                  </span>
                  <span aria-hidden>▸</span>
                </button>
                <button type="button" className="cv-skip" style={{ alignSelf: "center", flex: "none" }} onClick={() => setI(1)}>
                  Continue without sound
                </button>
              </div>
              <p className="cv-k cv-a" style={v({ "--t": "1200ms", marginTop: 16, opacity: 0.7 })}>
                Headphones or phone speaker up · the briefing starts by itself in a moment
              </p>
            </div>
          ) : s.id === "open" ? (
            <div className="cv-scene" style={{ textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <Logo size={96} />
              </div>
              <div style={{ marginTop: 18 }}>
                <span className="cv-stamp" style={v({ "--t": "300ms", color: "#FF5A1F", fontSize: "clamp(30px, 9vw, 64px)", transform: "rotate(-6deg)" })}>
                  The file is open
                </span>
              </div>
              <p className="cv-sub cv-a" style={v({ "--t": "800ms" })}>
                Decode • Discover • Win!
              </p>
              <div className="cv-cta cv-a" style={v({ "--t": "1100ms", justifyContent: "center" })}>
                <button className="btn btn-paper" onClick={close} type="button">
                  Enter the hunt <span aria-hidden>→</span>
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
      ▸ Replay briefing
    </button>
  );
}
