import Link from "next/link";
import { Footer, Marquee, Wordmark } from "@/components/ui/brand";
import { IconArrow, IconCamera } from "@/components/ui/icons";
import { BRAND } from "@/lib/brand";

export default function Home() {
  return (
    <>
      <main className="sheet anim-rise">
        <div className="t-meta" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0 10px" }}>
          <Wordmark size="sm" />
          <span>{BRAND.series}</span>
        </div>
        <hr className="rule-2" />
        <p className="t-meta" style={{ margin: "18px 0 0", color: "var(--color-graphite)" }}>
          {BRAND.department} · {BRAND.coordinates}
        </p>
        <h1 className="t-display" style={{ margin: "14px 0 8px" }}>
          Tech
          <br />
          Treasure
          <br />
          Hunt
        </h1>
        <p style={{ margin: 0, fontWeight: 500, fontSize: 19 }}>{BRAND.tagline}</p>

        <section className="card" style={{ marginTop: 26, padding: 16 }}>
          <p className="t-meta" style={{ margin: "0 0 8px" }}>
            Field instructions
          </p>
          <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
            <li>Collect your Team ID and password slip from the organisers.</li>
            <li>Scan the CP—01 QR at the registration desk with your camera app.</li>
            <li>Solve, decode, walk. Eight checkpoints. Stay together.</li>
          </ol>
        </section>

        <div style={{ display: "grid", gap: 16, marginTop: 24 }}>
          <Link className="btn btn-ink" href="/play">
            Continue my hunt <IconArrow />
          </Link>
          <Link className="btn btn-paper" href="/rules">
            Read the rules <IconArrow />
          </Link>
        </div>
        <p className="t-meta" style={{ margin: "18px 0 0", display: "flex", gap: 8, alignItems: "center" }}>
          <IconCamera size={14} /> Every checkpoint has a printed QR card.
        </p>
        <Footer />
      </main>
      <Marquee />
    </>
  );
}
