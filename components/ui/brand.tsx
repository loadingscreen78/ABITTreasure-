import { BRAND } from "@/lib/brand";

/**
 * Text wordmark until the official logo is supplied.
 * TODO(ORGANISER): add the official ABIT logo at public/brand/abit-logo.png and set BRAND.logo.
 * Do NOT draw, trace or recreate the ABIT logo.
 */
export function Wordmark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const fs = size === "lg" ? 30 : size === "sm" ? 14 : 18;
  if (BRAND.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={BRAND.logo} alt="ABIT logo" height={fs * 2} style={{ height: fs * 2, width: "auto" }} />;
  }
  return (
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
