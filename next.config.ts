import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // /s/<token> is a QR landing URL. It is served by one static shell page so a
  // scan costs no server render (Cloudflare Workers free plan: 10 ms CPU).
  async rewrites() {
    return [
      { source: "/s/:token", destination: "/scan" },
      { source: "/print/team/:id", destination: "/print/team" },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;

// Lets `next dev` use Cloudflare bindings locally. Harmless in `next build`.
if (process.env.NODE_ENV === "development") {
  import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev()).catch(() => {});
}
