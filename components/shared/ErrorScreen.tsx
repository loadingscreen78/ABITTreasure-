"use client";
import Link from "next/link";
import { Footer, Wordmark } from "@/components/ui/brand";

/** Branded error state with Retry — used by every error.tsx segment. */
export function ErrorScreen({ reset, title = "Signal lost", text = "Something went wrong loading this page. Your progress is saved on the server." }: { reset?: () => void; title?: string; text?: string }) {
  return (
    <main className="sheet anim-rise">
      <div className="t-meta" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0 10px" }}>
        <Wordmark size="sm" />
        <span>Tech Treasure Hunt</span>
      </div>
      <hr className="rule-2" />
      <h1 className="t-display" style={{ margin: "26px 0 12px", fontSize: 44 }}>
        {title}
      </h1>
      <p style={{ margin: 0, fontSize: 18 }}>{text}</p>
      <div style={{ display: "grid", gap: 14, marginTop: 24 }}>
        {reset && (
          <button className="btn btn-ink" onClick={reset}>
            Retry <span aria-hidden>→</span>
          </button>
        )}
        <Link className="btn btn-paper" href="/play">
          Go to my hunt <span aria-hidden>→</span>
        </Link>
      </div>
      <p style={{ margin: "16px 0 0", color: "var(--color-graphite)" }}>Still stuck? Find a volunteer.</p>
      <Footer />
    </main>
  );
}
