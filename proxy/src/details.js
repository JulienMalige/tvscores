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

/**
 * One game's page: fetched when a television opens it, never on a timer.
 * A finished game is kept twelve hours, anything else a minute, so a page
 * left open during a match costs a call a minute at most.
 */
export class EventDetails {
  constructor({ key, store, log = () => {}, fetch = getJson, now = () => Date.now() }) {
    Object.assign(this, { key, store, log, fetch, now });
    this.cache = new Map();
  }

  async get(id) {
    const event = this.store.events.get(id);
    const m = /^(football|nfl|nba):tsdb:(\d+)$/.exec(id);
    if (!event || !m || !this.key) return undefined;
    const hit = this.cache.get(id);
    const final = event.status?.state === "final";
    if (hit && this.now() - hit.at < (hit.final ? 12 * 3600e3 : 60e3)) return hit.body;
    const raw = m[2];
    const call = async (endpoint) => {
      const { body } = await this.fetch(`${V1}/${this.key}/${endpoint}.php?id=${raw}`);
      return body;
    };
    const [info, stats, timeline] = await Promise.all([
      call("lookupevent"),
      final || event.status?.state === "live" ? call("lookupeventstats") : undefined,
      event.sport === "football" && event.status?.state !== "scheduled" ? call("lookuptimeline") : undefined,
    ]);
    const row = info?.events?.[0] || {};
    const body = {
      id,
      venue: row.strVenue || undefined,
      city: row.strCity || undefined,
      periods: event.sport === "football" ? undefined : parsePeriods(row.strResult),
      stats: normaliseStats(event.sport, stats?.eventstats),
      timeline: normaliseTimeline(timeline?.timeline),
      records: recordsFor(this.store.standings, event),
    };
    this.cache.set(id, { at: this.now(), final, body });
    this.log(`GET sportsdb detail ${id} -> ${body.stats.length} stats, ${body.timeline.length} moments`);
    return body;
  }
}
