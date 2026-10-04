import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Bump when a cached shape changes. load() then drops the events, the derived
 * caches and the "fetched today" stamps, so every provider refills from
 * scratch on the next tick. That is what makes a provider swap safe: events
 * keyed by the old provider's ids would otherwise sit alongside the new ones
 * and show the same match twice.
 */
export const SCHEMA_VERSION = 6;

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
    this.broadcasts = {}; // per country: { FR: { tsdb: { idEvent: [names] }, xmltv: { eventId: [names] } } }, see broadcasts.js
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
      this.broadcasts = raw.broadcasts || {};
      this.meta = raw.meta || {};
      this.migrateBroadcasts();
      if (raw.schemaVersion !== SCHEMA_VERSION) {
        this.events.clear();
        this.photos = {};
        this.broadcasts = {};
        for (const m of Object.values(this.meta)) {
          delete m.lastStandings;
          delete m.lastDaily;
          delete m.lastToday;
          delete m.sources; // the TV channels' fetch stamps
        }
        this.dirty = true;
      }
    } catch {
      /* first run */
    }
  }

  /**
   * Before 2026-10-03 the channels were France's alone, at the top of
   * `broadcasts` and under `meta.broadcasts`; they move under "FR" as they
   * are, so nothing is fetched again.
   */
  migrateBroadcasts() {
    const { tsdb, xmltv } = this.broadcasts;
    if (tsdb || xmltv) {
      this.broadcasts = { FR: { tsdb, xmltv } };
      this.dirty = true;
    }
    if (this.meta.broadcasts) {
      this.meta["broadcasts:FR"] ??= this.meta.broadcasts;
      delete this.meta.broadcasts;
      this.dirty = true;
    }
  }

  /**
   * Writes only when something changed since the last save. `every` spares the
   * disk: the schedulers touch the meta each tick, and the whole file is
   * rewritten, so they ask for a write at most that often (a stop writes at once).
   */
  save({ every = 0 } = {}) {
    if (!this.dirty) return;
    if (every && Date.now() - (this.savedAt || 0) < every) return;
    this.savedAt = Date.now();
    const tmp = this.file + ".tmp";
    writeFileSync(tmp, JSON.stringify({ schemaVersion: SCHEMA_VERSION, events: [...this.events.values()], standings: this.standings, photos: this.photos, broadcasts: this.broadcasts, meta: this.meta }));
    renameSync(tmp, this.file);
    this.dirty = false;
  }

  touch() {
    this.dirty = true;
  }

  upsert(events) {
    if (events.length) this.dirty = true;
    for (const e of events) {
      const old = this.events.get(e.id);
      const merged = { ...old, ...e };
      // A second look that names a team without its crest (the live feed does)
      // must not take the crest the first look found.
      for (const side of ["home", "away"]) {
        if (old?.[side] && e[side]) merged[side] = { ...old[side], ...Object.fromEntries(Object.entries(e[side]).filter(([, v]) => v !== undefined)) };
      }
      this.events.set(e.id, merged);
    }
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
