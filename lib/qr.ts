import QRCode from "qrcode";

/** QR → crisp SVG (one <path>), error-correction level Q, 4-module quiet zone. Pure. */
export function qrSvg(text: string, opts: { margin?: number; ecc?: "L" | "M" | "Q" | "H" } = {}): { svg: string; size: number; modules: boolean[][] } {
  const margin = opts.margin ?? 4;
  const qr = QRCode.create(text, { errorCorrectionLevel: opts.ecc ?? "Q" });
  const n = qr.modules.size;
  const modules: boolean[][] = [];
  let d = "";
  for (let y = 0; y < n; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < n; x++) {
      const on = !!qr.modules.data[y * n + x];
      row.push(on);
      if (on) d += `M${x + margin} ${y + margin}h1v1h-1z`;
    }
    modules.push(row);
  }
  const size = n + margin * 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  return { svg, size, modules };
}
