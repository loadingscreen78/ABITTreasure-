// Windows: Vitest breaks when the cwd drive letter is lowercase (d:\ vs D:\ loads two module copies).
// Normalise the drive letter, then hand over to the Vitest CLI.
import { spawnSync } from "node:child_process";
import path from "node:path";

let cwd = process.cwd();
if (/^[a-z]:/.test(cwd)) cwd = cwd[0].toUpperCase() + cwd.slice(1);
const bin = path.join(cwd, "node_modules", "vitest", "vitest.mjs");
const r = spawnSync(process.execPath, [bin, ...process.argv.slice(2)], { cwd, stdio: "inherit" });
process.exit(r.status ?? 1);
