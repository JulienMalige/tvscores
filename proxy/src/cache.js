import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Bump when a cached shape changes; load() then drops derived caches (photos, standings stamps). */
export const SCHEMA_VERSION = 4;

/**
 * Event store persisted to disk so a restart or an upstream outage
 * still serves the last good data (with stale flags).
 */
export class Store {
  constructor(dir) {
    this.dir = dir;
    this.file = join(dir, "store.json");
    this.events = new Map();
    this.standings = {}; // "sport:leagueId" -> { updatedAt, tables }
    this.photos = {}; // athlete name -> { url|null, at }
    this.meta = {};
    this.dirty = false; // per sport: { lastDaily, lastLive, lastOk, lastError, calls: { day, used } }
    mkdirSync(dir, { recursive: true });
    this.load();
  }

  load() {
    try {
      const raw = JSON.parse(readFileSync(this.file, "utf8"));
      for (const e of raw.events || []) this.events.set(e.id, e);
      this.standings = raw.standings || {};
      this.photos = raw.photos || {};
      this.meta = raw.meta || {};
      if (raw.schemaVersion !== SCHEMA_VERSION) {
        this.photos = {};
        for (const m of Object.values(this.meta)) delete m.lastStandings;
        this.dirty = true;
      }
    } catch {
      /* first run */
    }
  }

  /** Writes only when something changed since the last save. */
  save() {
    if (!this.dirty) return;
    const tmp = this.file + ".tmp";
    writeFileSync(tmp, JSON.stringify({ schemaVersion: SCHEMA_VERSION, events: [...this.events.values()], standings: this.standings, photos: this.photos, meta: this.meta }));
    renameSync(tmp, this.file);
    this.dirty = false;
  }

  touch() {
    this.dirty = true;
  }

  upsert(events) {
    if (events.length) this.dirty = true;
    for (const e of events) this.events.set(e.id, { ...this.events.get(e.id), ...e });
  }

  setPhoto(name, entry) {
    this.photos[name] = entry;
    this.dirty = true;
  }

  /** Calendar sports: the season list is authoritative, replace everything for that sport. */
  replaceSport(sport, events) {
    for (const [id, e] of this.events) if (e.sport === sport) this.events.delete(id);
    this.dirty = true;
    this.upsert(events);
  }

  setStandings(sport, leagueId, data) {
    this.standings[`${sport}:${leagueId}`] = data;
    this.dirty = true;
  }

  /** True when the podium is cached (or a fetch already came back empty): never refetch every tick. */
  hasResults(id) {
    const e = this.events.get(id);
    if (!e || e.status.state !== "final") return false;
    if (e.resultsFetchedAt && !e.results?.length) return true; // empty classification, tried already
    // The podium is what needs full names (they drive the portrait lookup);
    // one nameless backmarker must not condemn the race to endless refetching.
    return Boolean(e.results?.length && e.results.slice(0, 3).every((r) => r.fullName));
  }

  /** Drop team-sport events older than 3 days (any state but live) so the file does not grow forever. */
  prune(now = Date.now()) {
    const cutoff = now - 3 * 86400e3;
    for (const [id, e] of this.events) {
      if (e.kind !== "race" && Date.parse(e.start) < cutoff && e.status.state !== "live") {
        this.events.delete(id);
        this.dirty = true;
      }
    }
  }

  sportMeta(sport) {
    return (this.meta[sport] ??= { calls: { day: "", used: 0 } });
  }

  all() {
    return [...this.events.values()];
  }
}
