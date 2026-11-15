import { createHmac, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * How the app is used, counted from the requests every copy of it already
 * makes: whether or not its viewer shares usage with Amplitude, and on every
 * version, 1.0 included (Julien, 2026-11-15; docs/analytics.md). Totals only,
 * one file a day under the cache directory, kept for good and not backed up
 * (Julien's choice).
 *
 * Within a day a device is told apart by a keyed hash of its address, its
 * user agent and its language. The key is random, lives in memory only and
 * goes with the day's table when the day closes, so no device can be followed
 * from one day to the next, and only counts reach the disk. A restart makes a
 * new key: the day carries what was counted before it, and a device seen on
 * both sides is counted twice, which the day's `restarts` owns up to.
 */

/** Board requests closer than this are one sitting: the app asks every 3 minutes, every 30 s during a game. */
export const SITTING_GAP = 10 * 60e3;
/** Upper bounds of the minutes-a-device buckets; one more bucket holds the rest. */
export const MINUTES = [1, 5, 15, 30, 60, 120];
/** The day's totals reach the disk at most this often, on a request, and when the process stops. */
const SAVE_EVERY = 5 * 60e3;
/** A day's devices, in memory; past this a new one is not counted. */
const MAX_DEVICES = 100_000;
const TABLE = /^\/v1\/standings\/([a-z0-9-]+)\/([a-z0-9-]+)$/;

const dayOf = (t) => new Date(t).toISOString().slice(0, 10);
const kindOf = (path) => (path === "/v1/scoreboard" ? "board" : path === "/v1/event" ? "game" : TABLE.test(path) ? "table" : null);

/** What a request says of the device, kept only in a form that names no one. */
const languageOf = (header) => {
  const tag = String(header ?? "").split(",")[0].split(";")[0].trim();
  return /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/i.test(tag) ? tag : "unknown";
};
const countryOf = (header) => (/^[A-Z]{2}$/.test(String(header ?? "")) && header !== "XX" ? header : "unknown");
const platformOf = (header) => (["tv", "phone", "pad"].includes(header) ? header : "unknown");

export const blank = (day) => ({
  day, restarts: 0, devices: 0, sittings: 0, boards: 0,
  minutes: { total: 0, buckets: Array(MINUTES.length + 1).fill(0) },
  hours: Array(24).fill(0),
  platforms: {}, builds: {}, countries: {}, timeZones: {}, languages: {},
  tables: {}, games: {},
});

/** Two days' totals added up, key by key: what came before a restart and what came after. */
export function sum(a, b) {
  if (typeof a === "number" || typeof b === "number") return (a ?? 0) + (b ?? 0);
  if (Array.isArray(a)) return a.map((v, i) => sum(v, b?.[i]));
  if (a && typeof a === "object") {
    const out = {};
    for (const key of new Set([...Object.keys(a), ...Object.keys(b ?? {})])) out[key] = sum(a[key], b?.[key]);
    return out;
  }
  return a ?? b;
}

const bump = (counts, key, field) => {
  if (field) {
    counts[key] ??= { opens: 0, devices: 0 };
    counts[key][field]++;
  } else counts[key] = (counts[key] ?? 0) + 1;
};
const bucketOf = (minutes) => {
  const i = MINUTES.findIndex((bound) => minutes < bound);
  return i === -1 ? MINUTES.length : i;
};

export class Audience {
  constructor({ dir, now = Date.now, newKey = () => randomBytes(32), log = () => {} }) {
    Object.assign(this, { dir, now, newKey, log });
    mkdirSync(dir, { recursive: true });
    this.open(dayOf(now()));
  }

  /** A new day, or this one again after a restart: a new key and an empty table. */
  open(day) {
    this.day = day;
    this.key = this.newKey();
    this.devices = new Map();
    this.opens = { boards: 0, tables: {}, games: {} };
    const before = this.read(day);
    this.carried = before ? { ...before, restarts: (before.restarts ?? 0) + 1 } : null;
    this.savedAt = this.now();
  }

  /** One request of the app's, counted if it is the board, a table or a game's page; counting never costs a request its answer. */
  note(req, path, url, tz) {
    try {
      this.count(req, path, url, tz);
    } catch (err) {
      this.log(`audience: ${err.message}`);
    }
  }

  count(req, path, url, tz) {
    const kind = kindOf(path);
    if (!kind) return;
    const ip = req.headers["cf-connecting-ip"];
    const ua = String(req.headers["user-agent"] ?? "");
    // The system's user agent: the app's name, its build, then the system's
    // network stack, "TV%20Scores/51 CFNetwork/… Darwin/…". Only the app
    // calls /v1/, so the name is not checked, whatever its escaping.
    const build = ua.match(/^[^/\s]+\/(\d+) CFNetwork\//)?.[1];
    // The app through Cloudflare only: not this machine's own calls, not a
    // browser, and not the builds CI runs against the live server (build 1).
    if (!ip || !build || build === "1") return;
    const t = this.now();
    if (dayOf(t) !== this.day) {
      this.close();
      this.open(dayOf(t));
    }
    const language = languageOf(req.headers["accept-language"]);
    const id = createHmac("sha256", this.key).update(`${ip}|${ua}|${language}`).digest("base64url");
    let device = this.devices.get(id);
    if (!device) {
      if (this.devices.size >= MAX_DEVICES) return;
      device = {
        build, language, country: countryOf(req.headers["cf-ipcountry"]), platform: platformOf(req.headers["x-tvscores-platform"]),
        timeZone: undefined, last: undefined, seconds: 0, sittings: 0, hours: new Set(), tables: new Set(), games: new Set(),
      };
      this.devices.set(id, device);
    }
    device.hours.add(new Date(t).getUTCHours());
    if (kind === "board") {
      this.opens.boards++;
      device.timeZone ??= tz;
      if (device.last === undefined || t - device.last > SITTING_GAP) device.sittings++;
      else device.seconds += (t - device.last) / 1000;
      device.last = t;
    } else if (kind === "table") {
      const [, sport, league] = path.match(TABLE);
      const key = `${sport}:${league}`;
      bump(this.opens.tables, key);
      device.tables.add(key);
    } else {
      const sport = String(url.searchParams.get("id") ?? "").split(":")[0];
      if (!/^[a-z0-9-]{1,20}$/.test(sport)) return;
      bump(this.opens.games, sport);
      device.games.add(sport);
    }
    if (t - this.savedAt > SAVE_EVERY) this.save();
  }

  /** The day so far: what was carried over a restart, and the table since. */
  totals() {
    const out = blank(this.day);
    for (const d of this.devices.values()) {
      out.devices++;
      out.sittings += d.sittings;
      out.minutes.total += d.seconds / 60;
      out.minutes.buckets[bucketOf(d.seconds / 60)]++;
      for (const hour of d.hours) out.hours[hour]++;
      bump(out.platforms, d.platform);
      bump(out.builds, d.build);
      bump(out.countries, d.country);
      bump(out.languages, d.language);
      if (d.timeZone) bump(out.timeZones, d.timeZone);
      for (const key of d.tables) bump(out.tables, key, "devices");
      for (const sport of d.games) bump(out.games, sport, "devices");
    }
    out.minutes.total = Math.round(out.minutes.total);
    out.boards = this.opens.boards;
    for (const [key, n] of Object.entries(this.opens.tables)) (out.tables[key] ??= { opens: 0, devices: 0 }).opens = n;
    for (const [sport, n] of Object.entries(this.opens.games)) (out.games[sport] ??= { opens: 0, devices: 0 }).opens = n;
    return this.carried ? { ...sum(this.carried, out), day: this.day } : out;
  }

  /** The day's totals to disk, atomically; a day with nothing in it writes nothing. */
  save() {
    this.savedAt = this.now();
    const totals = this.totals();
    if (!totals.devices && !this.carried) return;
    try {
      const file = join(this.dir, `${this.day}.json`);
      writeFileSync(`${file}.tmp`, JSON.stringify(totals));
      renameSync(`${file}.tmp`, file);
    } catch (err) {
      this.log(`audience: could not save ${this.day} (${err.message})`);
    }
  }

  /** The day ends: its totals are final, and the key and the table go with the next `open`. */
  close() {
    this.save();
  }

  read(day) {
    try {
      return JSON.parse(readFileSync(join(this.dir, `${day}.json`), "utf8"));
    } catch {
      return null;
    }
  }

  /** The last `n` days, newest first, today's as it stands. */
  days(n = 30) {
    const kept = readdirSync(this.dir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f.slice(0, 10) !== this.day)
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse()
      .slice(0, n - 1);
    return [this.totals(), ...kept.map((day) => this.read(day)).filter(Boolean)];
  }
}
