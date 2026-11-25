import Link from "next/link";
import { Footer, Marquee, Wordmark } from "@/components/ui/brand";
import { IconArrow, IconCamera, IconLock, IconPin, RoughFilter } from "@/components/ui/icons";
import { RegisterForm } from "@/components/home/RegisterForm";
import { BRAND } from "@/lib/brand";

// Static, prerendered welcome. Every animation is CSS (transform / opacity only) and
// becomes an instant swap with prefers-reduced-motion.

const BOOT: [string, string, number][] = [
  ["> ESTABLISHING FIELD LINK", "OK", 0],
  ["> CASE FILE TTH · CODE2CAREER", "OPEN", 260],
  ["> 8 CHECKPOINTS · 15 CLUES · 100 MARKS", "LOADED", 520],
  ["> CLEARANCE · 2ND-YEAR · TEAMS OF 3–4", "GRANTED", 780],
];

// Abstract route (positions are decorative — real locations stay classified).
const PINS: [number, number][] = [
  [46, 150],
  [92, 62],
  [168, 38],
  [248, 64],
  [282, 136],
  [214, 172],
  [140, 120],
  [64, 176],
];

function Letters({ text, start }: { text: string; start: number }) {
  return (
    <>
      {Array.from(text).map((ch, i) => (
        <span key={i} className="h-letter" style={{ ["--i" as string]: start + i }} aria-hidden>
          {ch}
        </span>
      ))}
    </>
  );
}

export default function Home() {
  return (
    <>
      <RoughFilter />
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

        <div className="home-grid" style={{ marginTop: 18 }}>
          {/* ---------- left: the case file ---------- */}
          <div>
            <div className="boot" role="presentation" aria-hidden>
              {BOOT.map(([l, ok, d]) => (
                <span key={l} className="boot-line" style={{ ["--d" as string]: d }}>
                  {l} <span className="ok">· {ok}</span>
                </span>
              ))}
              <span className="boot-line" style={{ ["--d" as string]: 1040 }}>
                {">"} <span className="boot-cursor" />
              </span>
            </div>

            <div className="h-title" style={{ marginTop: 22 }}>
              <h1 className="t-display" style={{ margin: 0, fontSize: "clamp(40px, 12.5vw, 84px)" }} aria-label="Tech Treasure Hunt">
                <Letters text="TECH" start={0} />
                <br />
                <Letters text="TREASURE" start={4} />
                <br />
                <Letters text="HUNT" start={12} />
              </h1>
              <span className="h-stamp" aria-hidden>
                <span className="stamp stamp-verified" style={{ fontSize: "clamp(14px, 3.6vw, 22px)", background: "color-mix(in srgb, var(--color-card) 70%, transparent)" }}>
                  Case file open
                </span>
              </span>
            </div>
            <p className="h-fade" style={{ ["--d" as string]: 1150, margin: "12px 0 0", fontSize: 20, fontWeight: 500 }}>
              {BRAND.tagline}
            </p>
            <p className="t-meta h-fade" style={{ ["--d" as string]: 1250, margin: "8px 0 0", color: "var(--color-graphite)" }}>
              {BRAND.department} · {BRAND.instituteFull}
            </p>

            {/* route map */}
            <section className="card route-card h-fade" style={{ ["--d" as string]: 1350, marginTop: 24, padding: 0 }} aria-label="The route: eight checkpoints, locations classified">
              <div className="t-meta" style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1.5px solid var(--color-ink)" }}>
                <span>Field map · route TTH</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--color-signal-text)" }}>
                  <IconLock size={12} /> Locations classified
                </span>
              </div>
              <div style={{ position: "relative" }}>
                <svg viewBox="0 0 320 210" width="100%" role="img" aria-label="Eight numbered checkpoints on a loop that starts and ends at the registration desk" style={{ display: "block" }}>
                  {PINS.slice(0, -1).map(([x, y], i) => {
                    const [x2, y2] = PINS[i + 1]!;
                    return <line key={i} className="route-seg" style={{ ["--i" as string]: i }} x1={x} y1={y} x2={x2} y2={y2} stroke="#121212" strokeWidth="2" strokeDasharray="5 5" />;
                  })}
                  {PINS.map(([x, y], i) => (
                    <g key={i} className="route-pin" style={{ ["--i" as string]: i }}>
                      <rect x={x - 11} y={y - 11} width="22" height="22" fill={i === 0 || i === 7 ? "#FF5A1F" : "#121212"} stroke="#121212" strokeWidth="1.5" />
                      <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontFamily="var(--font-mono)" fontWeight="600" fill={i === 0 || i === 7 ? "#121212" : "#F2EDE3"}>
                        {String(i + 1).padStart(2, "0")}
                      </text>
                    </g>
                  ))}
                  <text x="12" y="202" fontSize="9" fontFamily="var(--font-mono)" fill="#55534E" letterSpacing="1">
                    START + FINISH · REGISTRATION DESK
                  </text>
                </svg>
                <span className="route-scan" aria-hidden />
              </div>
            </section>

            {/* punch card */}
            <div className="h-fade" style={{ ["--d" as string]: 2050, marginTop: 22 }}>
              <div className="t-meta" style={{ marginBottom: 8 }}>
                Your punch card · one hole per checkpoint
              </div>
              <div className="punch" aria-hidden>
                {Array.from({ length: 8 }, (_, i) => (
                  <span key={i} className="hp-slot" style={{ ["--i" as string]: i }}>
                    <span className="hp-notch" style={{ ["--i" as string]: i }} />
                  </span>
                ))}
              </div>
            </div>

            {/* stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 24 }}>
              {[
                ["08", "Checkpoints"],
                ["15", "Clues"],
                ["~20", "Minutes"],
                ["3–4", "Per team"],
              ].map(([n, l], i) => (
                <div key={l} className="h-fade" style={{ ["--d" as string]: 2600 + i * 90, borderTop: "2px solid var(--color-ink)", paddingTop: 8 }}>
                  <div className="stat-n">{n}</div>
                  <div className="t-meta" style={{ marginTop: 4 }}>
                    {l}
                  </div>
                </div>
              ))}
            </div>

            {/* field instructions */}
            <section className="card h-fade" style={{ ["--d" as string]: 2950, marginTop: 26, padding: 16, position: "relative" }}>
              <span className="tape t-meta" style={{ position: "absolute", top: -12, left: 14 }}>
                Field instructions
              </span>
              <ol style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
                {[
                  "Register your team below, then collect your Team ID + password slip at the registration desk.",
                  "On the day, scan the CP—01 QR at the desk with your phone camera and log in.",
                  "Solve each checkpoint's question. A correct answer decrypts the riddle to the next place.",
                  "Eight checkpoints later, say the final phrase to the judge. Fastest perfect team wins the bonus.",
                ].map((s, i) => (
                  <li key={i} style={{ display: "grid", gridTemplateColumns: "34px 1fr", gap: 6 }}>
                    <span className="t-mono" style={{ fontWeight: 600 }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          {/* ---------- right: registration ---------- */}
          <div className="home-sticky h-fade" style={{ ["--d" as string]: 900 }} id="register">
            <RegisterForm />
            <div style={{ display: "grid", gap: 14, marginTop: 22 }}>
              <Link className="btn btn-paper" href="/play">
                Already playing? Continue my hunt <IconArrow />
              </Link>
              <Link className="btn btn-paper" href="/rules">
                Read the rules <IconArrow />
              </Link>
            </div>
            <p className="t-meta" style={{ margin: "16px 0 0", display: "flex", gap: 8, alignItems: "center" }}>
              <IconCamera size={14} /> Every checkpoint has a printed QR card.
            </p>
            <p className="t-meta" style={{ margin: "8px 0 0", display: "flex", gap: 8, alignItems: "center", color: "var(--color-graphite)" }}>
              <IconPin size={14} /> {BRAND.address}
            </p>
          </div>
        </div>
        <Footer />
      </main>
      <Marquee />
    </>
  );
}
