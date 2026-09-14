import { getJson } from "./http.js";

const BASE = "https://www.thesportsdb.com/api/v1/json";
const TTL_OK = 30 * 86400e3;
const TTL_MISS = 3 * 86400e3;
const SPORT_HINT = { f1: "Motorsport", motogp: "Motorsport", tennis: "Tennis", football: "Soccer", nfl: "American Football", nba: "Basketball" };

/** "Marc Márquez" -> "marc marquez" for exact, accent-insensitive comparison. */
const LETTER_MAP = { ł: "l", Ł: "l", ø: "o", Ø: "o", đ: "dj", Đ: "dj", ß: "ss", æ: "ae", Æ: "ae", œ: "oe", Œ: "oe", ı: "i" }; // đ -> dj as in "Djokovic"
export function normalise(name) {
  return String(name || "")
    .replace(/[łŁøØđĐßæÆœŒı]/g, (c) => LETTER_MAP[c])
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim()
    .replace(/\s+(jr|sr|ii|iii)$/, ""); // "Carlos Sainz Jr." and "Carlos Sainz" are the same name to us: two hits = ambiguous
}

/** The name a row is looked up and cached under: full name for people, nothing for teams or abbreviations. */
export function photoKey(row) {
  if (!row || row.kind === "team") return undefined;
  return row.fullName || (row.name && !/^[A-Z]\.\s/.test(row.name) ? row.name : undefined);
}

/**
 * Same sport and a cutout, then: exactly one exact name, or else exactly one candidate
 * whose words contain ours or are contained by ours, with the same surname
 * ("Kimi Antonelli" ~ "Andrea Kimi Antonelli" either way round).
 * Any ambiguity means no photo: a wrong face is worse than a monogram.
 */
export function pickPlayer(players, name, sport) {
  const want = normalise(name);
  const words = want.split(" ");
  const hint = SPORT_HINT[sport];
  const pool = players.filter((p) => p.strCutout && (!hint || p.strSport === hint));
  const exact = pool.filter((p) => normalise(p.strPlayer) === want);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null; // namesakes in the same sport: don't guess
  const related = pool.filter((p) => {
    const theirs = normalise(p.strPlayer).split(" ");
    if (theirs.at(-1) !== words.at(-1)) return false;
    return words.every((w) => theirs.includes(w)) || theirs.every((w) => words.includes(w));
  });
  return related.length === 1 ? related[0] : null;
}

/**
 * Resolves a head-and-shoulders cutout per athlete from TheSportsDB, one lookup
 * per name, cached in the store for a month. Runs in the background so serving
 * never waits on it; rows carry `photo` only once known.
 */
export class PhotoResolver {
  constructor({ store, key = "3", log = () => {}, perMinute = 25 }) {
    this.store = store;
    this.key = key;
    this.log = log;
    this.interval = Math.ceil(60000 / perMinute);
    this.meta = store.sportMeta("photos"); // daily call counter, shown in /v1/health
  }

  cached(name) {
    const hit = this.store.photos[name];
    if (!hit) return undefined;
    const age = Date.now() - hit.at;
    if (hit.url ? age > TTL_OK : age > TTL_MISS) return undefined;
    return hit;
  }

  /**
   * Names without a fresh cache entry, most visible first: podiums and today's
   * matches (priority 0), top ten of each table (1), then the long tail (2).
   */
  pending() {
    const wanted = new Map(); // name -> { sport, prio }
    const want = (row, sport, prio) => {
      const k = photoKey(row);
      if (!k) return;
      const cur = wanted.get(k);
      if (!cur || prio < cur.prio) wanted.set(k, { sport, prio });
    };
    const today = new Date().toISOString().slice(0, 10);
    for (const e of this.store.events.values()) {
      for (const r of e.results || []) want(r, e.sport, 0);
      if (e.sport === "tennis") {
        const prio = e.status.state === "live" || String(e.start).startsWith(today) ? 0 : 2;
        for (const side of ["home", "away"]) want(e[side], "tennis", prio);
      }
    }
    for (const [key, s] of Object.entries(this.store.standings)) {
      const sport = key.split(":")[0];
      for (const t of s.tables || []) for (const r of t.rows) want(r, sport, r.pos <= 10 ? 1 : 2);
    }
    return [...wanted]
      .filter(([name]) => !this.cached(name))
      .sort((a, b) => a[1].prio - b[1].prio)
      .map(([name, { sport }]) => [name, sport]);
  }

  async lookup(name, sport) {
    const { body } = await getJson(`${BASE}/${this.key}/searchplayers.php?p=${encodeURIComponent(name)}`);
    const day = new Date().toISOString().slice(0, 10);
    if (this.meta.calls.day !== day) this.meta.calls = { day, used: 0 };
    this.meta.calls.used += 1;
    const pick = pickPlayer(body.player || [], name, sport);
    return pick ? pick.strCutout : null;
  }

  async tick() {
    const todo = this.pending().slice(0, 15);
    for (const [name, sport] of todo) {
      try {
        const url = await this.lookup(name, sport);
        this.store.setPhoto(name, { url, at: Date.now() });
        this.meta.lastOk = new Date().toISOString();
      } catch (err) {
        this.log(`photo ${name}: ${err.message}`);
        this.store.setPhoto(name, { url: null, at: Date.now() - TTL_MISS + 3600e3 }); // retry in an hour
      }
      await new Promise((r) => setTimeout(r, this.interval));
    }
    if (todo.length) {
      this.store.save();
      this.log(`photos: resolved ${todo.length}, ${this.pending().length} pending`);
    }
    this.timer = setTimeout(() => this.tick(), todo.length ? 1000 : 5 * 60e3);
    this.timer.unref?.();
  }

  start() {
    this.tick();
  }

  stop() {
    clearTimeout(this.timer);
  }

  /** Attach cached photo URLs to a serialisable copy of an event / table row set. */
  photoFor(name) {
    return this.cached(name)?.url || undefined;
  }
}
