/**
 * Minimal dependency-free .xlsx writer + reader (Web APIs only: works in browsers, Workers and Node 20+).
 * Writer: one sheet, inline strings, stored (uncompressed) zip — opens in Excel / Google Sheets / LibreOffice.
 * Reader: handles files saved by Excel (deflate + sharedStrings) via DecompressionStream("deflate-raw").
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

// ---------- CRC32 ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ---------- zip (stored) ----------
function zipStored(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = new Uint8Array(30 + name.length);
    const v = new DataView(local.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 0x0800, true); // UTF-8 names
    v.setUint16(8, 0, true); // stored
    v.setUint32(14, crc, true);
    v.setUint32(18, f.data.length, true);
    v.setUint32(22, f.data.length, true);
    v.setUint16(26, name.length, true);
    local.set(name, 30);
    chunks.push(local, f.data);

    const cd = new Uint8Array(46 + name.length);
    const w = new DataView(cd.buffer);
    w.setUint32(0, 0x02014b50, true);
    w.setUint16(4, 20, true);
    w.setUint16(6, 20, true);
    w.setUint16(8, 0x0800, true);
    w.setUint16(10, 0, true);
    w.setUint32(16, crc, true);
    w.setUint32(20, f.data.length, true);
    w.setUint32(24, f.data.length, true);
    w.setUint16(28, name.length, true);
    w.setUint32(42, offset, true);
    cd.set(name, 46);
    central.push(cd);
    offset += local.length + f.data.length;
  }
  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, files.length, true);
  e.setUint16(10, files.length, true);
  e.setUint32(12, cdSize, true);
  e.setUint32(16, offset, true);
  const all = [...chunks, ...central, end];
  const out = new Uint8Array(all.reduce((s, c) => s + c.length, 0));
  let p = 0;
  for (const c of all) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // strip characters XML 1.0 can't hold
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

const colName = (i: number) => {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

/** Build an .xlsx with one sheet. First row is treated as a header (bold). */
export function writeXlsx(rows: (string | number | null | undefined)[][], sheetName = "Sheet1"): Uint8Array {
  const sheetRows = rows
    .map((r, ri) => {
      const cells = r
        .map((v, ci) => {
          const ref = `${colName(ci)}${ri + 1}`;
          const style = ri === 0 ? ' s="1"' : "";
          if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"${style}><v>${v}</v></c>`;
          const text = v === null || v === undefined ? "" : String(v);
          return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${esc(text)}</t></is></c>`;
        })
        .join("");
      return `<row r="${ri + 1}">${cells}</row>`;
    })
    .join("");
  const widths = (rows[0] ?? []).map((_, i) => `<col min="${i + 1}" max="${i + 1}" width="${i === 0 ? 28 : 20}" customWidth="1"/>`).join("");
  const files = [
    {
      name: "[Content_Types].xml",
      xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(sheetName.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    {
      name: "xl/styles.xml",
      xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>`,
    },
    {
      name: "xl/worksheets/sheet1.xml",
      xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${widths}</cols><sheetData>${sheetRows}</sheetData></worksheet>`,
    },
  ];
  return zipStored(files.map((f) => ({ name: f.name, data: enc.encode(f.xml) })));
}

// ---------- reader ----------
async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzip(buf: Uint8Array): Promise<Map<string, Uint8Array>> {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not an .xlsx file (zip directory not found).");
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out = new Map<string, Uint8Array>();
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true);
    const csize = v.getUint32(p + 20, true);
    const nlen = v.getUint16(p + 28, true);
    const xlen = v.getUint16(p + 30, true);
    const clen = v.getUint16(p + 32, true);
    const lho = v.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nlen));
    const lnlen = v.getUint16(lho + 26, true);
    const lxlen = v.getUint16(lho + 28, true);
    const start = lho + 30 + lnlen + lxlen;
    const raw = buf.subarray(start, start + csize);
    if (/^(xl\/sharedStrings\.xml|xl\/worksheets\/sheet1\.xml|xl\/workbook\.xml)$/.test(name) || /^xl\/worksheets\/sheet\d+\.xml$/.test(name)) {
      out.set(name, method === 0 ? raw : method === 8 ? await inflateRaw(raw) : new Uint8Array());
    }
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

const unesc = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");

const textOf = (xml: string) => unesc([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(""));

const colIndex = (ref: string) => {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

/** Read the first sheet of an .xlsx into rows of strings. */
export async function readXlsx(input: ArrayBuffer | Uint8Array): Promise<string[][]> {
  const files = await unzip(input instanceof Uint8Array ? input : new Uint8Array(input));
  const sheetName = files.has("xl/worksheets/sheet1.xml") ? "xl/worksheets/sheet1.xml" : [...files.keys()].find((k) => k.startsWith("xl/worksheets/"));
  if (!sheetName) throw new Error("No worksheet found in this .xlsx file.");
  const shared = files.has("xl/sharedStrings.xml")
    ? [...dec.decode(files.get("xl/sharedStrings.xml") ?? new Uint8Array()).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]!))
    : [];
  const sheet = dec.decode(files.get(sheetName) ?? new Uint8Array());
  const rows: string[][] = [];
  for (const rm of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cm of rm[1]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1] ?? "";
      const body = cm[2] ?? "";
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1] ?? colName(row.length) + "1";
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let val = "";
      if (type === "s") val = shared[Number(v)] ?? "";
      else if (type === "inlineStr") val = textOf(body);
      else if (v !== undefined) val = unesc(v);
      row[colIndex(ref)] = val;
    }
    rows.push(Array.from(row, (x) => x ?? ""));
  }
  return rows;
}
