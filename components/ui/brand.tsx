import { BRAND } from "@/lib/brand";

/** Official ABIT logo + boxed "ABIT" wordmark. */
export function Wordmark({ size = "md", text = true }: { size?: "sm" | "md" | "lg" | "xl"; text?: boolean }) {
  const fs = size === "xl" ? 40 : size === "lg" ? 30 : size === "sm" ? 14 : 18;
  const px = size === "xl" ? 112 : size === "lg" ? 72 : size === "sm" ? 30 : 42;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: Math.round(px / 5) }}>
      {BRAND.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={BRAND.logo} alt="Ajay Binay Institute of Technology logo" width={px} height={px} style={{ width: px, height: px, display: "block" }} decoding="async" />
      )}
      {text && (
        <span
          aria-label="ABIT"
          style={{
            fontFamily: "var(--font-display)",
            fontVariationSettings: '"wdth" 125',
            fontWeight: 800,
            fontSize: fs,
            lineHeight: 1,
            border: "1.5px solid currentColor",
            color: "inherit",
            padding: "4px 7px 3px",
            display: "inline-block",
            letterSpacing: "0.02em",
          }}
        >
          ABIT
        </span>
      )}
    </span>
  );
}

export function Footer({ invert = false }: { invert?: boolean }) {
  return (
    <footer className="t-meta" style={{ color: invert ? "var(--color-paper)" : "var(--color-graphite)", padding: "28px 0 8px" }}>
      <hr className="rule-1" style={{ borderColor: "currentColor", marginBottom: 12 }} />
      <p style={{ margin: "0 0 6px" }}>{BRAND.instituteFull}</p>
      <p style={{ margin: 0 }}>{BRAND.footer}</p>
    </footer>
  );
}

export function Marquee({ invert = false }: { invert?: boolean }) {
  const text = "DECODE • DISCOVER • WIN • CODE2CAREER • ABIT CUTTACK • ";
  const run = text.repeat(6);
  return (
    <div className="marquee t-display-sm" aria-hidden style={{ color: invert ? "var(--color-paper)" : "var(--color-ink)", fontSize: 20 }}>
      <span className="marquee-track">
        {run}
        {run}
      </span>
    </div>
  );
}
