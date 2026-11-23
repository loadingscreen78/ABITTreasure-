import Link from "next/link";
import { Footer, Wordmark } from "@/components/ui/brand";
import { IconArrow } from "@/components/ui/icons";
import { BRAND, RULES } from "@/lib/brand";

export const metadata = { title: "Rules · Tech Treasure Hunt" };

export default function RulesPage() {
  return (
    <main className="sheet anim-rise">
      <div className="t-meta" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0 10px" }}>
        <Wordmark size="sm" />
        <span>{BRAND.series}</span>
      </div>
      <hr className="rule-2" />
      <h1 className="t-display" style={{ margin: "22px 0 6px", fontSize: 44 }}>
        Rules
      </h1>
      <p className="t-meta" style={{ margin: "0 0 16px", color: "var(--color-graphite)" }}>
        Read with your team · {RULES.length} items
      </p>
      <ol className="card" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {RULES.map((r, i) => (
          <li key={i} style={{ display: "grid", gridTemplateColumns: "44px 1fr", borderTop: i ? "1px solid var(--color-ink)" : 0 }}>
            <span className="t-mono tabular" style={{ padding: "12px 0 12px 12px", fontWeight: 600 }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span style={{ padding: "12px 14px 12px 4px" }}>{r}</span>
          </li>
        ))}
      </ol>
      <div style={{ marginTop: 24 }}>
        <Link className="btn btn-ink" href="/play">
          Back to my hunt <IconArrow />
        </Link>
      </div>
      <Footer />
    </main>
  );
}
