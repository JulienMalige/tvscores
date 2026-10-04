import { existsSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

/** Drop images nothing has asked for in a long while, and files no entry names. */
export function prune(mirror, now = Date.now()) {
  let dropped = 0;
  for (const [key, entry] of [...mirror.entries]) {
    if (now - (entry.lastUsed || 0) <= mirror.maxAge) continue;
    const path = mirror.file(key);
    if (path) { try { unlinkSync(path); } catch { /* already gone */ } }
    mirror.entries.delete(key);
    dropped++;
  }
  // Files with no manifest entry (a manifest lost or hand-edited) go too.
  const known = new Set([...mirror.entries.keys()]);
  for (const name of readdirSync(mirror.dir)) {
    if (name === "index.json" || name.endsWith(".tmp")) continue;
    if (!known.has(name.replace(/\.[a-z]+$/, ""))) {
      try { unlinkSync(join(mirror.dir, name)); dropped++; } catch { /* already gone */ }
    }
  }
  if (dropped) { mirror.dirty = true; mirror.save(); }
  return dropped;
}

/** What the mirror holds, for the health page: it walks every file, so ask sparingly. */
export function stats(mirror) {
  let stored = 0;
  let bytes = 0;
  for (const [key, entry] of mirror.entries) {
    const path = mirror.file(key);
    if (path && existsSync(path)) { stored++; bytes += entry.bytes || 0; }
  }
  return { known: mirror.entries.size, stored, pending: mirror.entries.size - stored, megabytes: Math.round((bytes / 1e6) * 10) / 10 };
}
