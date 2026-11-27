import Link from "next/link";
import { Footer, Marquee, Wordmark } from "@/components/ui/brand";
import { IconArrow, IconCamera, IconLock, IconPin, RoughFilter } from "@/components/ui/icons";
import { RegisterForm } from "@/components/home/RegisterForm";
import { Seal, RouteMap } from "@/components/home/art";
import { Cipher, LiveStatus, Reveal, Scramble, SplitFlap } from "@/components/home/fx";
import { IntroFilm, ReplayButton } from "@/components/home/Intro";
import { Faq, PhoneDemo, Rules, Scoring, Timeline, Wallet } from "@/components/home/briefing";
import { BRAND } from "@/lib/brand";

// Static, prerendered welcome. Motion is CSS + native SVG animation with a few tiny client islands.
// Everything becomes an instant swap under prefers-reduced-motion. No clues or answers on this page.

const TICK =
  "Inaugural edition  •  Est. 2026  •  Case file TTH  •  Classified  •  8 checkpoints  •  15 clues  •  100 marks  •  2nd-year teams of 3–4  •  ABIT Cuttack  •  Code2Career  •  ";

// Runs before first paint: skip the cover on repeat visits in this session / for reduced motion.
// (Injects a <style> rather than touching <html>, so React hydration stays clean.)
const PRE = `try{if(sessionStorage.getItem('tth-intro')||matchMedia('(prefers-reduced-motion: reduce)').matches){window.__tthSeen=1;document.head.insertAdjacentHTML('beforeend','<style id="tth-seen">.cover{display:none!important}.stage{animation-delay:calc(var(--d,0)*1ms)!important}.hero-watermark,.seal{animation-delay:.3s!important}</style>')}else{window.__tthOpen=1;document.head.insertAdjacentHTML('beforeend','<style id="tth-hold">.stage,.hero-watermark,.seal,.ticker-track{animation-play-state:paused!important}</style>');setTimeout(function(){var h=document.getElementById('tth-hold');if(h)h.remove()},45000)}}catch(e){}`;

const STEPS: [string, string, string][] = [
  ["Enlist", "Register your team below. On the day, collect your Team ID + password slip at the registration desk.", "-2deg"],
  ["Scan", "Point your phone camera at the CP—01 QR card at the desk and log in. Every phone in the team can join.", "1.5deg"],
  ["Decode", "Crack each checkpoint's question. A correct answer decrypts a riddle that points to the next place.", "-1deg"],
  ["Claim", "Eight checkpoints later, say the final phrase to the judge. The fastest perfect team takes the bonus.", "2deg"],
];

function SecHead({ no, title, kicker }: { no: string; title: string; kicker: string }) {
  return (
    <div className="sec-head">
      <span className="sec-no" aria-hidden>
        {no}
      </span>
      <div>
        <div className="t-meta" style={{ color: "var(--color-graphite)" }}>
          {kicker}
        </div>
        <h2 className="t-display-sm" style={{ margin: "4px 0 0", fontSize: "clamp(24px, 6vw, 36px)" }}>
          {title}
        </h2>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: PRE }} />
      <RoughFilter />
      <IntroFilm />
      <div className="scroll-bar" aria-hidden />
      <div className="ticker" aria-hidden>
        <span className="ticker-track">
          {TICK.split("•").map((part, i, a) => (
            <span key={i}>
              {part}
              {i < a.length - 1 && <b>•</b>}
            </span>
          ))}
          {TICK.split("•").map((part, i, a) => (
            <span key={`b${i}`}>
              {part}
              {i < a.length - 1 && <b>•</b>}
            </span>
          ))}
        </span>
      </div>

      <main className="home-wrap">
        <div className="t-meta" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 0 10px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <Wordmark size="sm" />
            <span style={{ whiteSpace: "nowrap" }}>{BRAND.series}</span>
          </span>
          <span className="tabular" style={{ whiteSpace: "nowrap" }}>
            {BRAND.coordinates}
          </span>
        </div>
        <hr className="rule-2" />

        {/* ---------------- HERO ---------------- */}
        <section className="hero">
          <div className="hero-watermark" aria-hidden>
            08
          </div>
          <Seal />
          <p className="t-meta stage" style={{ ["--d" as string]: 0, margin: "0 0 18px", maxWidth: "62%" }}>
            {BRAND.series} · {BRAND.edition} · {BRAND.est} · {BRAND.department}
          </p>
          <h1 className="hero-title" aria-label="Tech Treasure Hunt">
            <span className="w stage" style={{ ["--d" as string]: 60 }}>
              <Scramble text="TECH" delay={1950} />
            </span>
            <span className="w w2 stage" style={{ ["--d" as string]: 160 }}>
              <span className="hl">
                <Scramble text="TREASURE" delay={2100} />
              </span>
            </span>
            <span className="w stage" style={{ ["--d" as string]: 260 }}>
              <Scramble text="HUNT" delay={2250} />
            </span>
          </h1>

          <div className="stage" style={{ ["--d" as string]: 380, marginTop: 22 }}>
            <SplitFlap words={["DECODE", "DISCOVER", "WIN!"]} />
          </div>
          <div className="stage" style={{ ["--d" as string]: 480, marginTop: 18 }}>
            <LiveStatus />
          </div>
          <div className="cta-row stage" style={{ ["--d" as string]: 580, marginTop: 24 }}>
            <a className="btn btn-ink" href="#register">
              Register your team <span aria-hidden>↓</span>
            </a>
            <Link className="btn btn-paper" href="/play">
              Continue my hunt <IconArrow />
            </Link>
          </div>
          <div className="stage" style={{ ["--d" as string]: 760, marginTop: 22, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <a className="scroll-cue t-meta" href="#route" style={{ textDecoration: "none" }}>
              Open the file <i aria-hidden>↓</i>
            </a>
            <ReplayButton />
          </div>
        </section>

        {/* ---------------- 01 BRIEFING ---------------- */}
        <section id="route" style={{ marginTop: 20, scrollMarginTop: 16 }}>
          <SecHead no="01" kicker="Mission briefing · how it works" title="Scan. Solve. Decrypt. Move." />
          <p style={{ margin: "0 0 18px", maxWidth: 640 }}>
            The Tech Treasure Hunt is a 20-minute race around the ABIT campus for 2nd-year teams of 3–4. Eight printed QR cards hide at eight
            places. Each one asks a tech question; get it right and the riddle to the next place decrypts on your phone. Watch the briefing:
          </p>
          <PhoneDemo />
        </section>

        {/* ---------------- 02 ROUTE ---------------- */}
        <section style={{ marginTop: 48 }}>
          <SecHead no="02" kicker="Field map · route TTH" title="Eight stops. One loop." />
          <Reveal className="card" style={{ padding: 0, overflow: "hidden" }} r="0deg" r0="-1deg">
            <div className="t-meta" style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1.5px solid var(--color-ink)" }}>
              <span>Live route</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--color-signal-text)" }}>
                <IconLock size={12} /> Locations classified
              </span>
            </div>
            <RouteMap />
          </Reveal>
          <p style={{ margin: "12px 0 0", color: "var(--color-graphite)" }}>
            Every checkpoint hides a printed QR card. Scan it, answer, and the next location decrypts on your phone — only for your team, only in order.
          </p>
        </section>

        {/* ---------------- 03 SCORING ---------------- */}
        <section style={{ marginTop: 48 }}>
          <SecHead no="03" kicker="The 100-mark scheme" title="How you score" />
          <Scoring />
        </section>

        {/* ---------------- 04 WALLET ---------------- */}
        <section style={{ marginTop: 48 }}>
          <SecHead no="04" kicker="Hint wallet · separate from your score" title="Earn it. Spend it." />
          <Reveal className="card" style={{ padding: 16 }} r="0deg" r0="-1deg">
            <Wallet />
          </Reveal>
        </section>

        <div className="band" aria-hidden>
          <span>
            {"Decode <b>•</b> Discover <b>•</b> Win <b>•</b> Code2Career <b>•</b> ABIT Cuttack <b>•</b> "
              .repeat(4)
              .split(/(<b>•<\/b>)/)
              .map((s, i) => (s === "<b>•</b>" ? <b key={i}>•</b> : <span key={i}>{s}</span>))}
          </span>
        </div>

        {/* ---------------- 05 CIPHER ---------------- */}
        <section style={{ marginTop: 56 }}>
          <SecHead no="05" kicker="Training exercise" title="Crack the cipher" />
          <Reveal className="card" style={{ padding: 16 }} r="0deg" r0="1deg">
            <Cipher />
          </Reveal>
          <p className="t-meta" style={{ margin: "10px 0 0", color: "var(--color-graphite)" }}>
            Warm-up only. The real clues unlock on the day.
          </p>
        </section>

        {/* ---------------- 06 DAY ---------------- */}
        <section style={{ marginTop: 48 }}>
          <SecHead no="06" kicker="Order of the day" title="Day of the hunt" />
          <Timeline />
        </section>

        {/* ---------------- 07 RULES ---------------- */}
        <section style={{ marginTop: 48 }}>
          <SecHead no="07" kicker="Rules of engagement" title="Play it straight" />
          <Rules />
        </section>

        {/* ---------------- 08 INSTRUCTIONS ---------------- */}
        <section style={{ marginTop: 48 }}>
          <SecHead no="08" kicker="Read before deployment" title="Field instructions" />
          <div className="evidence-grid">
            {STEPS.map(([t, s, r], i) => (
              <Reveal key={t} className="evidence" r={r} r0={i % 2 ? "6deg" : "-6deg"} d={i * 90}>
                <span className="pin" aria-hidden />
                <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                  <span className="no">{String(i + 1).padStart(2, "0")}</span>
                  <span className="t-display-sm" style={{ fontSize: 22 }}>
                    {t}
                  </span>
                </div>
                <p style={{ margin: "10px 0 0" }}>{s}</p>
              </Reveal>
            ))}
          </div>
          <Reveal style={{ marginTop: 26 }} d={100}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {[
                ["08", "Checkpoints"],
                ["15", "Clues"],
                ["~20", "Minutes"],
                ["3–4", "Per team"],
              ].map(([n, l]) => (
                <div key={l} style={{ borderTop: "2px solid var(--color-ink)", paddingTop: 8 }}>
                  <div className="stat-n">{n}</div>
                  <div className="t-meta" style={{ marginTop: 4 }}>
                    {l}
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ---------------- 09 FAQ ---------------- */}
        <section style={{ marginTop: 48 }}>
          <SecHead no="09" kicker="Questions from the field" title="FAQ" />
          <Faq />
        </section>

        {/* ---------------- 10 REGISTER ---------------- */}
        <section id="register" className="home-split" style={{ marginTop: 48, scrollMarginTop: 16 }}>
          <div>
            <SecHead no="10" kicker="Teams of 3–4 · 2nd year" title="Enlist your team" />
            <p style={{ margin: "0 0 12px" }}>File your team now. The organisers turn every registration into a Team ID and password, printed on a slip you collect at the registration desk.</p>
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
              <li>Only team and member names are collected.</li>
              <li>Keep your reference number — show it at the desk.</li>
              <li>
                Read the{" "}
                <Link href="/rules" style={{ fontWeight: 600 }}>
                  rules
                </Link>{" "}
                together before the day.
              </li>
            </ul>
            <p className="t-meta" style={{ margin: "18px 0 0", display: "flex", gap: 8, alignItems: "center" }}>
              <IconCamera size={14} /> Every checkpoint has a printed QR card.
            </p>
            <p className="t-meta" style={{ margin: "8px 0 0", display: "flex", gap: 8, alignItems: "center", color: "var(--color-graphite)" }}>
              <IconPin size={14} /> {BRAND.address}
            </p>
          </div>
          <div>
            <RegisterForm />
            <Link className="btn btn-paper" href="/rules" style={{ marginTop: 18 }}>
              Read the rules <IconArrow />
            </Link>
          </div>
        </section>

        {/* ---------------- FINAL CTA ---------------- */}
        <Reveal className="final-cta" r="-1deg" r0="-4deg">
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <Wordmark size="lg" text={false} />
            <div className="t-meta">{BRAND.instituteFull} · {BRAND.department}</div>
          </div>
          <h2 style={{ marginTop: 16 }}>
            Are you
            <br />
            in?
          </h2>
          <p style={{ margin: "12px 0 18px", fontSize: 18, fontWeight: 600, maxWidth: 520 }}>Eight checkpoints. Fifteen clues. One treasure. Bring your team, your phone and your best guess.</p>
          <a className="btn btn-ink" href="#register" style={{ maxWidth: 420 }}>
            Enlist your team <span aria-hidden>↑</span>
          </a>
        </Reveal>

        <Footer />
      </main>
      <Marquee />
    </>
  );
}
