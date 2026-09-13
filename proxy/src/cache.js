import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Event store persisted to disk so a restart or an upstream outage
 * still serves the last good data (with stale flags).
 */
export class Store {
  constructor(dir) {
    this.dir = dir;
    this.file = join(dir, "store.json");
    this.events = new Map();
    this.meta = {}; // per sport: { lastDaily, lastLive, lastOk, lastError, calls: { day, used } }
    mkdirSync(dir, { recursive: true });
    this.load();
  }

  load() {
    try {
      const raw = JSON.parse(readFileSync(this.file, "utf8"));
      for (const e of raw.events || []) this.events.set(e.id, e);
      this.meta = raw.meta || {};
    } catch {
      /* first run */
    }
  }

  save() {
    const tmp = this.file + ".tmp";
    writeFileSync(tmp, JSON.stringify({ events: [...this.events.values()], meta: this.meta }));
    renameSync(tmp, this.file);
  }

  upsert(events) {
    for (const e of events) this.events.set(e.id, { ...this.events.get(e.id), ...e });
  }

  /** Drop events older than 3 days so the file does not grow forever. */
  prune(now = Date.now()) {
    const cutoff = now - 3 * 86400e3;
    for (const [id, e] of this.events) if (Date.parse(e.start) < cutoff && e.status.state === "final") this.events.delete(id);
  }

  sportMeta(sport) {
    return (this.meta[sport] ??= { calls: { day: "", used: 0 } });
  }

  all() {
    return [...this.events.values()];
  }
}
