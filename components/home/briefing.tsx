/**
 * Home "briefing" sections: a self-playing phone demo of the real app flow, scoring explained,
 * hint wallet, the day's timeline, rules and FAQ. Sample content only — no real clue or answer.
 */
import type { CSSProperties, ReactNode } from "react";
import { RULES } from "@/lib/brand";
import { Reveal } from "./fx";

const v = (o: Record<string, string | number>) => o as CSSProperties;

function Scene({ i, children }: { i: number; children: ReactNode }) {
  return (
    <div className={`scene${i === 0 ? " first" : ""}`} style={v({ "--i": i })}>
      {children}
    </div>
  );
}

function MiniQr() {
  // decorative pseudo-QR (not a real code)
  const cells = "1110111010111011101000101011011011101010110111000101110101010111101101101101011101010110111011101".split("");
  return (
    <svg viewBox="0 0 11 9" width="64%" style={{ position: "absolute", left: "18%", top: "22%" }} aria-hidden>
      {cells.map((c, k) => (c === "1" ? <rect key={k} x={k % 11} y={Math.floor(k / 11)} width="1" height="1" fill="#121212" /> : null))}
    </svg>
  );
}

export function PhoneDemo() {
  const steps: [string, string][] = [
    ["Scan", "Find a checkpoint card and point your camera at its QR."],
    ["Log in", "Team ID + password from your slip. Every phone in the team works."],
    ["Solve", "Each checkpoint asks a tech question. Answer on your phone."],
    ["Verified", "Right answer: a stamp, marks, and your punch card gets a hole."],
    ["Decrypt", "The riddle to the next place decrypts — only for your team."],
    ["Move", "Walk there, find the next QR, repeat. Eight checkpoints in all."],
  ];
  return (
    <div className="demo">
      <div className="phone" role="img" aria-label="Animated demo of the hunt on a phone: scan, log in, solve, verified, decrypt, move">
        <div className="phone-screen">
          <Scene i={0}>
            <div className="meta">Camera · scanning</div>
            <div className="vf">
              <i />
              <i />
              <i />
              <i />
              <MiniQr />
              <span className="vf-scan" />
            </div>
            <div className="meta beat" style={v({ "--i": 0, "--b": "1.2s", marginTop: 18, textAlign: "center", color: "#B23A0E" })}>
              Checkpoint detected · CP—04
            </div>
          </Scene>
          <Scene i={1}>
            <div className="t-display" style={{ fontSize: 30, margin: "6px 0 14px" }}>
              Tech
              <br />
              Treasure
              <br />
              Hunt
            </div>
            <div className="meta">Team ID</div>
            <div className="t-mono" style={{ fontSize: 20, borderBottom: "3px solid #121212", padding: "4px 0", marginBottom: 12 }}>
              <span className="type-reveal" style={v({ "--i": 1, "--b": "0.3s" })}>
                T07
              </span>
            </div>
            <div className="meta">Password</div>
            <div className="t-mono" style={{ fontSize: 20, borderBottom: "3px solid #121212", padding: "4px 0" }}>
              <span className="type-reveal" style={v({ "--i": 1, "--b": "0.9s" })}>
                ••••-•••
              </span>
            </div>
            <div className="beat" style={v({ "--i": 1, "--b": "1.7s", marginTop: 16, background: "#121212", color: "#F2EDE3", padding: "10px", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", boxShadow: "3px 3px 0 0 #FF5A1F" })}>
              UNLOCK CHECKPOINT →
            </div>
          </Scene>
          <Scene i={2}>
            <div className="t-numeral" style={{ fontSize: 52 }}>
              CP—04
            </div>
            <div style={{ border: "1.5px solid #121212", background: "#FBF8F2", marginTop: 10, boxShadow: "3px 3px 0 0 #121212" }}>
              <div className="meta" style={{ borderBottom: "1.5px solid #121212", padding: "5px 8px" }}>
                [ Q·?? // sample ]
              </div>
              <div style={{ padding: "8px", fontSize: 13 }}>How many bits make one byte?</div>
            </div>
            <div className="meta" style={{ marginTop: 14 }}>
              Your answer
            </div>
            <div className="t-mono" style={{ fontSize: 20, borderBottom: "3px solid #121212", padding: "4px 0" }}>
              <span className="type-reveal" style={v({ "--i": 2, "--b": "0.8s" })}>
                8
              </span>
            </div>
            <div className="beat" style={v({ "--i": 2, "--b": "1.6s", marginTop: 12, background: "#121212", color: "#F2EDE3", padding: "10px", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", boxShadow: "3px 3px 0 0 #FF5A1F" })}>
              SUBMIT ANSWER →
            </div>
          </Scene>
          <Scene i={3}>
            <div style={{ display: "grid", placeItems: "center", height: "70%" }}>
              <span className="beat" style={v({ "--i": 3, "--b": "0.2s" })}>
                <span className="stamp stamp-verified" style={{ fontSize: 26 }}>
                  Verified
                </span>
              </span>
            </div>
            <div className="meta beat" style={v({ "--i": 3, "--b": "0.7s", textAlign: "center", color: "#0E6B4C", fontSize: 12 })}>
              ✓ +5 marks
            </div>
            <div className="punch beat" style={v({ "--i": 3, "--b": "1.1s", marginTop: 14 })}>
              {Array.from({ length: 8 }, (_, k) => (
                <span key={k} className={`punch-slot${k < 4 ? " is-done" : k === 4 ? " is-current" : ""}`} style={{ height: 18 }} />
              ))}
            </div>
          </Scene>
          <Scene i={4}>
            <div style={{ position: "relative", border: "1.5px solid #121212", background: "#FBF8F2", padding: "20px 10px 10px", marginTop: 14, boxShadow: "3px 3px 0 0 #121212" }}>
              <span className="tape t-meta" style={{ position: "absolute", top: -10, left: 8, fontSize: 9 }}>
                Clue · sample
              </span>
              <div className="meta" style={{ color: "#55534E", marginBottom: 6 }}>
                Next location · decrypted
              </div>
              <div className="t-riddle" style={{ fontSize: 15 }}>
                &ldquo;
                <span className="type-reveal on-card" style={v({ "--i": 4, "--b": "0.3s" })}>
                  I hum all day and glow on every desk. Find the room where I live.
                </span>
                &rdquo;
              </div>
            </div>
            <div className="beat" style={v({ "--i": 4, "--b": "1.4s", marginTop: 14, fontWeight: 600, fontSize: 13 })}>
              Go there. Find the QR for CP—05.
            </div>
          </Scene>
          <Scene i={5}>
            <div className="meta">Field map</div>
            <svg viewBox="0 0 120 150" width="100%" aria-hidden style={{ marginTop: 6 }}>
              <path d="M20 130 L30 80 L60 60 L95 75 L100 35" fill="none" stroke="#121212" strokeWidth="2" strokeDasharray="4 4" />
              {[
                [20, 130],
                [30, 80],
                [60, 60],
                [95, 75],
                [100, 35],
              ].map(([x, y], k) => (
                <rect key={k} x={x! - 6} y={y! - 6} width="12" height="12" fill={k < 4 ? "#121212" : "#FF5A1F"} stroke="#121212" strokeWidth="1.5" />
              ))}
              <rect x="-5" y="-5" width="10" height="10" fill="#F2C230" stroke="#121212" strokeWidth="1.5" className="motion-only">
                <animateMotion dur="3s" begin="0s" repeatCount="indefinite" path="M95 75 L100 35" />
              </rect>
            </svg>
            <div className="beat" style={v({ "--i": 5, "--b": "0.6s", fontWeight: 600, fontSize: 13, textAlign: "center" })}>
              Next stop: CP—05
            </div>
          </Scene>
        </div>
      </div>
      <ol className="demo-steps">
        {steps.map(([t, d], i) => (
          <li key={t} style={v({ "--i": i })}>
            <span className="n">{String(i + 1).padStart(2, "0")}</span>
            <span>
              <strong style={{ display: "block", fontFamily: "var(--font-display)", fontVariationSettings: '"wdth" 125', textTransform: "uppercase", fontSize: 18 }}>{t}</strong>
              <span style={{ fontSize: 15 }}>{d}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Scoring() {
  const items: [string, string, string, string][] = [
    ["m1", "75", "Clues", "15 clues × 5. Location riddles score when you arrive at the right QR; questions score full marks within 3 tries."],
    ["m2", "15", "Final treasure", "Solve the last lock at the finish desk and say the phrase to the judge."],
    ["m3", "5", "Teamwork", "Judges award up to 5 for teamwork and playing by the rules."],
    ["m4", "5", "Speed bonus", "Fastest perfect teams: 5 / 3 / 1. Same total? The faster team gets +0.5 / +0.25 / +0.1."],
  ];
  return (
    <Reveal>
      <div className="meter" role="img" aria-label="Scoring: 75 clues, 15 final, 5 teamwork, 5 speed bonus = 100">
        {items.map(([c, n], k) => (
          <span key={c} className={c} style={v({ "--k": k })}>
            {n}
          </span>
        ))}
      </div>
      <div className="legend">
        {items.map(([c, n, t, d]) => (
          <div key={c}>
            <div className="t-meta">
              <span className={`sw ${c}`} style={{ background: c === "m1" ? "#121212" : c === "m2" ? "#FF5A1F" : c === "m3" ? "#F2C230" : "#0E6B4C" }} />
              {t} · {n}
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 15 }}>{d}</p>
          </div>
        ))}
      </div>
      <div className="strip strip-note" style={{ marginTop: 16 }}>
        <strong>Fair play:</strong> wrong answers after the 3rd try no longer score, and each team gets at most <strong>5 wrong tries a minute</strong> across all its phones. Near-misses (like &ldquo;right idea, give the short name&rdquo;) don&apos;t cost a try.
      </div>
    </Reveal>
  );
}

export function Wallet() {
  return (
    <Reveal>
      <div style={{ display: "grid", gap: 18 }}>
        <div>
          <div className="t-meta" style={{ marginBottom: 8 }}>
            Earn · first three questions
          </div>
          <div className="chips">
            {[0, 1, 2].map((k) => (
              <span key={k} className="chip-coin" style={v({ "--k": k })}>
                +10
              </span>
            ))}
            <span className="chip-coin" style={v({ "--k": 3, background: "#121212", color: "#F2EDE3" })}>
              30
            </span>
          </div>
        </div>
        <div>
          <div className="t-meta" style={{ marginBottom: 8 }}>
            Spend · on any later question
          </div>
          <div className="tiers">
            {[
              ["Low", "5", "A gentle push"],
              ["Medium", "10", "A strong pointer"],
              ["High", "15", "Almost there"],
            ].map(([t, c, d]) => (
              <div key={t} className="tier">
                <div className="t-meta">{t}</div>
                <div className="cost">{c}</div>
                <div style={{ fontSize: 13 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 15, color: "var(--color-graphite)" }}>Hint points are a separate wallet — spending them never lowers your score. Spend wisely: 30 points buys all three hints for just one question.</p>
      </div>
    </Reveal>
  );
}

export function Timeline() {
  const t: [string, string, boolean][] = [
    ["Registration desk", "Show your reference, collect your Team ID + password slip.", false],
    ["Briefing", "Organisers explain the rules. Phones charged, camera ready.", false],
    ["Launch countdown", "The admin hits START — every phone counts down together.", true],
    ["Eight checkpoints", "Scan, solve, decrypt, move. Stay together as a team.", false],
    ["Finish desk", "Enter the final phrase, say it to the judge, show your 4-digit code.", true],
    ["Results", "Scores revealed on the big screen. Fastest perfect team takes the bonus.", false],
  ];
  return (
    <Reveal>
      <ol className="tl">
        {t.map(([h, d, hot], k) => (
          <li key={h} className={hot ? "hot" : undefined} style={v({ "--k": k })}>
            <div className="t-display-sm" style={{ fontSize: 20 }}>
              {h}
            </div>
            <div style={{ fontSize: 15, marginTop: 2 }}>{d}</div>
          </li>
        ))}
      </ol>
    </Reveal>
  );
}

export function Rules() {
  return (
    <Reveal>
      <ol className="rules-list">
        {RULES.map((r, k) => (
          <li key={k}>
            <span className="tick" style={v({ "--k": k })} aria-hidden>
              ✓
            </span>
            <span>{r}</span>
          </li>
        ))}
      </ol>
    </Reveal>
  );
}

export function Faq() {
  const qa: [string, string][] = [
    ["Can everyone in the team use their own phone?", "Yes. Log in on as many phones as you like with the same Team ID — progress is shared, so every phone always shows the same clue."],
    ["What if we scan the wrong QR?", "Nothing breaks. You'll see WRONG TURN and your current clue again. Checkpoints only unlock in order."],
    ["What if the signal drops?", "Your answer is kept and retried automatically. Your progress lives on the server, not the phone."],
    ["What happens when two teams have the same score?", "The team that finished faster wins the tie: +0.5 for the fastest, +0.25 for the next, +0.1 for the third — never enough to jump a team that truly scored more."],
    ["Can we buy hints on the first questions?", "No. The first three questions fill your hint wallet (10 points each). Hints unlock from the fourth question onward."],
    ["Do we need the internet to search answers?", "No — and you shouldn't. Every answer can be worked out with what you know. Searching is against the rules unless a clue says otherwise."],
  ];
  return (
    <Reveal className="faq">
      {qa.map(([q, a]) => (
        <details key={q}>
          <summary>{q}</summary>
          <div>{a}</div>
        </details>
      ))}
    </Reveal>
  );
}
