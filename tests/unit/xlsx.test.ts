import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { readXlsx, writeXlsx } from "@/lib/xlsx";
import { parseTeamsCsv, toCsv } from "@/lib/csv";

describe("xlsx export / import", () => {
  it("round-trips the registration sheet (incl. unicode and XML characters)", async () => {
    const rows = [
      ["name", "member1", "member2", "member3", "member4"],
      ["Byte Bandits", "Asha", "Ravi", "Sneha", ""],
      ["<Null> & Void", "Jagannāth", "O\"Neil", "Priya", "Kiran"],
    ];
    const back = await readXlsx(writeXlsx(rows, "Registrations"));
    expect(back).toEqual(rows.map((r) => r.map(String)));
    // feeds straight into the bulk team import
    expect(parseTeamsCsv(toCsv(back))).toEqual([
      { name: "Byte Bandits", members: ["Asha", "Ravi", "Sneha"] },
      { name: "<Null> & Void", members: ["Jagannāth", 'O"Neil', "Priya", "Kiran"] },
    ]);
  });

  it("reads a file saved by Excel (deflate-compressed, shared strings)", async () => {
    const enc = new TextEncoder();
    const shared = `<sst><si><t>name</t></si><si><t>member1</t></si><si><t>Team Ω</t></si><si><t>Ravi</t></si></sst>`;
    const sheet = `<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2" t="s"><v>3</v></c><c r="D2"><v>42</v></c></row></sheetData></worksheet>`;
    const files = [
      { name: "xl/sharedStrings.xml", data: deflateRawSync(enc.encode(shared)) },
      { name: "xl/worksheets/sheet1.xml", data: deflateRawSync(enc.encode(sheet)) },
    ];
    // hand-build a zip with method 8 entries
    const parts: Uint8Array[] = [];
    const central: Uint8Array[] = [];
    let off = 0;
    for (const f of files) {
      const name = enc.encode(f.name);
      const lh = new Uint8Array(30 + name.length);
      const v = new DataView(lh.buffer);
      v.setUint32(0, 0x04034b50, true);
      v.setUint16(8, 8, true);
      v.setUint32(18, f.data.length, true);
      v.setUint16(26, name.length, true);
      lh.set(name, 30);
      const cd = new Uint8Array(46 + name.length);
      const w = new DataView(cd.buffer);
      w.setUint32(0, 0x02014b50, true);
      w.setUint16(10, 8, true);
      w.setUint32(20, f.data.length, true);
      w.setUint16(28, name.length, true);
      w.setUint32(42, off, true);
      cd.set(name, 46);
      parts.push(lh, new Uint8Array(f.data));
      central.push(cd);
      off += lh.length + f.data.length;
    }
    const cdSize = central.reduce((s, c) => s + c.length, 0);
    const end = new Uint8Array(22);
    const e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true);
    e.setUint16(10, files.length, true);
    e.setUint32(12, cdSize, true);
    e.setUint32(16, off, true);
    const all = [...parts, ...central, end];
    const buf = new Uint8Array(all.reduce((s, c) => s + c.length, 0));
    let p = 0;
    for (const c of all) {
      buf.set(c, p);
      p += c.length;
    }
    expect(await readXlsx(buf)).toEqual([
      ["name", "member1"],
      ["Team Ω", "", "Ravi", "42"],
    ]);
  });

  it("rejects files that are not xlsx", async () => {
    await expect(readXlsx(new TextEncoder().encode("name,member1\nA,B"))).rejects.toThrow(/Not an .xlsx/);
  });
});
