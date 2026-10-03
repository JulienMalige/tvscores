import { getJson } from "./http.js";

const V1 = "https://www.thesportsdb.com/api/v1/json";

/**
 * The statistics a game's page shows, in its order, by the name the feed
 * gives them. A trimmed set on purpose — Julien, 2026-09-28: "a simplified
 * version of statistics". The app names each by `id` in four languages.
 */
const STATS = {
  football: [
    ["Ball Possession", "possession"], ["Total Shots", "shots"], ["Shots on Goal", "shotsOnTarget"],
    ["Corner Kicks", "corners"], ["Fouls", "fouls"], ["Offsides", "offsides"], ["Goalkeeper Saves", "saves"],
  ],
  nba: [
    ["2-points %", "twoPct"], ["3-points %", "threePct"], ["Free Throws %", "freeThrowPct"], ["Rebounds", "rebounds"],
    ["Assists", "assists"], ["Steals", "steals"], ["Blocks", "blocks"], ["Turnovers", "turnovers"],
  ],
};

const num = (v) => {
  const text = String(v ?? "").replace("%", "").trim();
  if (!text) return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * The score by period, from the feed's `strResult`, which is prose with
 * line breaks and comes in two shapes:
 *   NBA  "Spurs Quarters:<br>23 19 30 18 <br><br>Knicks Quarters:<br>13 24 28 29 "
 *   NFL  "Broncos Quarter 1:<br>0 7 <br>Quarter 2<br>0 9 <br>…<br>Overtime<br> "
 * The NFL's pairs are home then away; an empty overtime is no period.
 */
export function parsePeriods(text) {
  const s = String(text || "");
  const lists = [...s.matchAll(/Quarters:<br>([\d ]+)(?:<|$)/g)].map((m) => m[1].trim().split(/\s+/).map(Number));
  if (lists.length === 2 && lists[0].length && lists[0].length === lists[1].length) {
    return { labels: lists[0].map((_, i) => String(i + 1)), home: lists[0], away: lists[1] };
  }
  const pairs = [...s.matchAll(/(Quarter (\d)|Overtime):?<br>(\d+) (\d+)/g)];
  if (pairs.length) {
    return {
      labels: pairs.map((m) => (m[2] ? m[2] : "OT")),
      home: pairs.map((m) => Number(m[3])),
      away: pairs.map((m) => Number(m[4])),
    };
  }
  return undefined;
}

export function normaliseStats(sport, rows) {
  const wanted = STATS[sport];
  if (!wanted || !Array.isArray(rows)) return [];
  return wanted
    .map(([name, id]) => {
      const row = rows.find((r) => r.strStat === name);
      const home = num(row?.intHome), away = num(row?.intAway);
      return home === undefined || away === undefined ? undefined : { id, home, away };
    })
    .filter(Boolean);
}

/** Goals and cards, in minute order; substitutions are left out. */
export function normaliseTimeline(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => {
      const detail = String(r.strTimelineDetail || "").toLowerCase();
      let kind;
      if (r.strTimeline === "Goal") kind = detail.includes("own") ? "ownGoal" : detail.includes("penal") ? "penalty" : "goal";
      else if (r.strTimeline === "Card") kind = detail.includes("red") || detail.includes("second") ? "red" : "yellow";
      if (!kind) return undefined;
      return { minute: num(r.intTime) ?? 0, side: r.strHome === "Yes" ? "home" : "away", kind, player: r.strPlayer || undefined };
    })
    .filter(Boolean)
    .sort((a, b) => a.minute - b.minute);
}

/** "W-D-L" for football, "W-L" (or "W-L-T" once there is a tie) for the others, from a table row. */
export function recordOf(table, row) {
  if (!row?.cells || !table?.columns) return undefined;
  const at = (c) => { const i = table.columns.indexOf(c); return i < 0 ? undefined : row.cells[i]; };
  const w = at("w"), d = at("d"), l = at("l"), t = at("t");
  if (w === undefined || l === undefined) return undefined;
  if (d !== undefined) return `${w}-${d}-${l}`;
  return t !== undefined && Number(t) > 0 ? `${w}-${l}-${t}` : `${w}-${l}`;
}

/** Both sides' records from their competition's table, when it has them. */
export function recordsFor(standings, event) {
  const tables = standings?.[`${event.sport}:${event.league?.id}`]?.tables || [];
  const find = (name) => {
    for (const table of tables) {
      const row = table.rows?.find((r) => r.name === name);
      if (row) return recordOf(table, row);
    }
    return undefined;
  };
  return { home: find(event.home?.name), away: find(event.away?.name) };
}

const LIVE_REFRESH = 90e3;       // a watched live game is refreshed this often
const LIVE_SERVE = 120e3;        // ...and a copy this young is served as it is
const LEASE = 5 * 60e3;          // a game nobody has asked for in this long is let go
const FILLING = 5 * 60e3;        // a finished football game still missing its numbers
const FINAL = 12 * 3600e3;       // a finished game, complete
const OPEN_GAME = 60e3;          // anything else
const MAX_LEASES = 15;           // most games refreshed on their own at once

/**
 * One game's page. A television opening it is what starts the work, and the
 * work then belongs to the game, not to the viewer:
 *   - the first request fetches at once and takes a lease on a live game;
 *   - while the lease lives (every request renews it, so an open page keeps
 *     it), the proxy refreshes the game every 90 s on its own, and requests
 *     are answered from what it holds. A hundred viewers cost what one does;
 *   - five minutes without a request and the game is let go. Nothing runs
 *     for a match nobody opens;
 *   - simultaneous requests for a game share one fetch;
 *   - a football venue never changes, so it is fetched once, and a live
 *     football game costs two calls a refresh (statistics, timeline).
 * A finished game is kept twelve hours, but five minutes while a football
 * game is still missing its statistics or its goals: TheSportsDB fills the
 * Brasileirão's in hours after the whistle, and an empty answer must not
 * outlive the wait (2026-10-03).
 */
export class EventDetails {
  constructor({ key, store, log = () => {}, fetch = getJson, now = () => Date.now(), timers = true }) {
    Object.assign(this, { key, store, log, fetch, now, timers });
    this.cache = new Map();
    this.venues = new Map();
    this.pending = new Map();
    this.leases = new Map();
    this.timer = null;
  }

  async get(id) {
    const event = this.store.events.get(id);
    if (!event || !/^(football|nfl|nba):tsdb:\d+$/.test(id) || !this.key) return undefined;
    if (event.status?.state === "live") this.lease(id);
    const hit = this.cache.get(id);
    if (hit && this.now() - hit.at < hit.ttl) return hit.body;
    return this.load(id);
  }

  /** Takes or renews the lease on a live game, and starts the refresh if it was idle. */
  lease(id) {
    this.leases.set(id, this.now());
    if (this.timers && !this.timer) {
      this.timer = setTimeout(() => this.refreshLeased().finally(() => { this.timer = null; this.rearm(); }), LIVE_REFRESH);
      this.timer.unref?.();
    }
  }

  rearm() {
    if (this.timers && this.leases.size && !this.timer) {
      this.timer = setTimeout(() => this.refreshLeased().finally(() => { this.timer = null; this.rearm(); }), LIVE_REFRESH);
      this.timer.unref?.();
    }
  }

  /** One round: refresh each leased live game, drop the idle, finish the ones that ended. */
  async refreshLeased() {
    const now = this.now();
    const kept = [];
    for (const [id, seen] of this.leases) {
      const state = this.store.events.get(id)?.status?.state;
      if (now - seen > LEASE || (state !== "live" && state !== "final")) { this.leases.delete(id); continue; }
      kept.push([id, seen, state]);
    }
    kept.sort((a, b) => b[1] - a[1]);
    for (const [id, , state] of kept.slice(0, MAX_LEASES)) {
      if (state === "final") this.leases.delete(id);
      await this.load(id).catch((err) => this.log(`detail refresh ${id} failed: ${err.message}`));
    }
    for (const [id] of kept.slice(MAX_LEASES)) this.leases.delete(id);
  }

  /** One fetch per game at a time: whoever arrives meanwhile waits for it. */
  load(id) {
    if (!this.pending.has(id)) {
      const job = this.fetchDetail(id).finally(() => this.pending.delete(id));
      this.pending.set(id, job);
    }
    return this.pending.get(id);
  }

  async fetchDetail(id) {
    const event = this.store.events.get(id);
    const m = /^(football|nfl|nba):tsdb:(\d+)$/.exec(id);
    const raw = m[2];
    const state = event.status?.state;
    const football = event.sport === "football";
    const call = async (endpoint) => {
      const { body } = await this.fetch(`${V1}/${this.key}/${endpoint}.php?id=${raw}`);
      return body;
    };
    const [info, stats, timeline] = await Promise.all([
      football && this.venues.has(id) ? undefined : call("lookupevent"),
      state === "final" || state === "live" ? call("lookupeventstats") : undefined,
      football && state !== "scheduled" ? call("lookuptimeline") : undefined,
    ]);
    if (info) {
      const row = info.events?.[0] || {};
      if (this.venues.size >= 500) this.venues.delete(this.venues.keys().next().value);
      this.venues.set(id, { venue: row.strVenue || undefined, city: row.strCity || undefined, result: row.strResult });
    }
    const where = this.venues.get(id) || {};
    const shown = normaliseStats(event.sport, stats?.eventstats), moments = normaliseTimeline(timeline?.timeline);
    const body = {
      id,
      venue: where.venue,
      city: where.city,
      periods: football ? undefined : parsePeriods(where.result),
      stats: shown,
      timeline: moments,
      records: recordsFor(this.store.standings, event),
    };
    const final = state === "final";
    const filling = final && football && (!body.stats.length || !body.timeline.length);
    const ttl = filling ? FILLING : final ? FINAL : state === "live" ? LIVE_SERVE : OPEN_GAME;
    this.cache.set(id, { at: this.now(), ttl, body });
    this.log(`GET sportsdb detail ${id} -> ${body.stats.length} stats, ${body.timeline.length} moments`);
    return body;
  }
}
