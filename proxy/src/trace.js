import { readFileSync, statSync, readdirSync, mkdirSync, appendFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const CAP = 512 * 1024;
const FILES = 64;                  // devices we keep a trace for; a new one past this is turned away
export const POSTS_PER_MIN = 120;  // across every device

/** Append trace lines to `<cacheDir>/traces/<device>.log`, halving it past the cap. Returns false when turned away. */
export function appendTrace(cacheDir, device, lines) {
  const dir = join(cacheDir, "traces");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${device}.log`);
  if (!existsSync(file) && !makeRoom(dir)) return false;
  const stamp = new Date().toISOString();
  // One line each: a newline inside one would forge the next entry.
  const text = lines.slice(0, 500).map((l) => `${stamp} ${String(l).replace(/[\r\n]+/g, " ").slice(0, 300)}\n`).join("");
  appendFileSync(file, text);
  try {
    if (statSync(file).size > CAP) {
      const kept = readFileSync(file, "utf8");
      writeFileSync(file, kept.slice(kept.length >> 1));
    }
  } catch { /* the file is a convenience; losing a line of it is fine */ }
  return true;
}

/** Room for one more device: when the directory is full, the oldest trace untouched for a day goes. */
function makeRoom(dir) {
  const files = readdirSync(dir).map((name) => ({ name, at: statSync(join(dir, name)).mtimeMs }));
  if (files.length < FILES) return true;
  const oldest = files.sort((a, b) => a.at - b.at)[0];
  if (Date.now() - oldest.at < 24 * 3600e3) return false;
  unlinkSync(join(dir, oldest.name));
  return true;
}
