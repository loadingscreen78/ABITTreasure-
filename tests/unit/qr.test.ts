import jsQR from "jsqr";
import { describe, expect, it } from "vitest";
import { qrSvg } from "@/lib/qr";

/** Rasterise the module matrix (the same one drawn into the SVG) and decode it with jsQR. */
function decode(text: string): string | null {
  const { modules } = qrSvg(text);
  const n = modules.length;
  const scale = 6;
  const quiet = 4;
  const size = (n + quiet * 2) * scale;
  const px = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (!modules[y]![x]) continue;
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) {
          const i = (((y + quiet) * scale + dy) * size + (x + quiet) * scale + dx) * 4;
          px[i] = px[i + 1] = px[i + 2] = 0;
        }
    }
  return jsQR(px, size, size)?.data ?? null;
}

describe("print QA: QR codes decode to the exact payload", () => {
  it.each([
    "https://abit-hunt.example.workers.dev/s/AbC12xYz",
    "http://localhost:3000/s/jjNQk8MI",
    "Your secret word is ORBIT.",
  ])("%s", (text) => expect(decode(text)).toBe(text));

  it("SVG has a white quiet zone and one path", () => {
    const { svg } = qrSvg("hello");
    expect(svg).toContain('fill="#fff"');
    expect(svg.match(/<path/g)).toHaveLength(1);
  });
});
