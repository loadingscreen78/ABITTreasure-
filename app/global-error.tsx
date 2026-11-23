"use client";

// Last-resort boundary (replaces the root layout), so it carries its own minimal styles.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ margin: 0, background: "#F2EDE3", color: "#121212", fontFamily: "IBM Plex Sans, Helvetica Neue, Arial, sans-serif" }}>
        <main style={{ maxWidth: 480, margin: "0 auto", padding: "24px 20px" }}>
          <p style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>ABIT · CODE2CAREER · Tech Treasure Hunt</p>
          <hr style={{ border: 0, borderTop: "2px solid #121212" }} />
          <h1 style={{ fontSize: 40, textTransform: "uppercase", lineHeight: 0.95, margin: "24px 0 12px" }}>Signal lost</h1>
          <p style={{ fontSize: 18 }}>Something went wrong. Your progress is saved on the server.</p>
          <button
            onClick={reset}
            style={{ width: "100%", minHeight: 56, background: "#121212", color: "#F2EDE3", border: "1.5px solid #121212", boxShadow: "4px 4px 0 0 #FF5A1F", fontFamily: "monospace", fontSize: 15, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 16 }}
          >
            Retry
          </button>
          <p style={{ fontSize: 11, fontFamily: "monospace", marginTop: 28, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Ajay Binay Institute of Technology (Autonomous), Cuttack
          </p>
        </main>
      </body>
    </html>
  );
}
