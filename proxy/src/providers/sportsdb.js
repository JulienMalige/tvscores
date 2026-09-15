import { getJson } from "../http.js";
import { STATE, team } from "../model.js";

const V1 = "https://www.thesportsdb.com/api/v1/json";
const V2 = "https://www.thesportsdb.com/api/v2/json";

const LIVE = new Set(["1H", "2H", "HT", "ET", "BT", "P"]);
const FINAL = new Set(["FT", "AET", "PEN"]);

/** The English detail strings the app's string catalogue already knows. */
const DETAIL = {
  HT: "Half-time", ET: "Extra time", BT: "Break", P: "Penalties",
  AET: "After extra time", PEN: "After penalties",
};

/**
 * `strTimestamp` is UTC but carries no zone, so it has to be marked as UTC
 * before parsing — otherwise every kickoff moves by the server's own offset.
 */
export function startOf(row) {
  const stamp = row.strTimestamp || (row.dateEvent && row.strTime ? `${row.dateEvent}T${row.strTime}` : null);
  if (!stamp) return null;
  const utc = /[Zz]|[+-]\d{2}:?\d{2}$/.test(stamp) ? stamp : `${stamp}Z`;
  const at = new Date(utc);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

/** "0" and 0 are scores; "" and null are not. A drawn game really is 0-0. */
const score = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

export function normaliseEvent(row, league) {
  const start = startOf(row);
  if (!start) return null;
  const short = row.strStatus || "";
  let state = STATE.other;
  if (row.strPostponed === "yes") state = STATE.other;
  else if (!short || short === "NS") state = STATE.scheduled;
  else if (LIVE.has(short)) state = STATE.live;
  else if (FINAL.has(short)) state = STATE.final;
  // `strProgress` is the minute of a game in play, and is meaningless at the interval.
  const minute = row.strProgress && !["HT", "BT", "P"].includes(short) ? `${row.strProgress}'` : undefined;
  return {
    id: `football:tsdb:${row.idEvent}`,
    sport: "football",
    league: { id: league.id, name: league.name, short: league.short },
    kind: "match",
    start,
    round: row.intRound ? `Round ${row.intRound}` : undefined,
    status: {
      state,
      clock: state === STATE.live ? minute : undefined,
      detail: row.strPostponed === "yes" ? "Postponed" : DETAIL[short],
    },
    home: team(row.strHomeTeam, undefined, { logo: row.strHomeTeamBadge || undefined }),
    away: team(row.strAwayTeam, undefined, { logo: row.strAwayTeamBadge || undefined }),
    score: { home: score(row.intHomeScore), away: score(row.intAwayScore) },
  };
}

/** Local calendar days either side of today, as the `YYYY-MM-DD` the feed wants. */
export function datesAround({ back, ahead }, now = new Date()) {
  const out = [];
  for (let d = -back; d <= ahead; d++) {
    const day = new Date(now);
    day.setUTCDate(day.getUTCDate() + d);
    out.push(day.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Football from TheSportsDB: one call per day of the window, filtered to the
 * competitions we show. The paid key returns up to 1,500 events for a date,
 * which is why a seven-day Upcoming costs eight calls rather than a season
 * fixture list per league.
 */
export function sportsDbFootball({ key, leagues, window: win, quota, log = () => {} }) {
  const byId = new Map(leagues.map((l) => [String(l.id), l]));
  const mine = (rows) =>
    rows
      .filter((r) => byId.has(String(r.idLeague)))
      .map((r) => normaliseEvent(r, byId.get(String(r.idLeague))))
      .filter(Boolean);

  /**
   * One date. The scheduler asks for this when a match it was watching leaves
   * the live feed: the livescore endpoint only lists games in progress, so a
   * match that ends simply vanishes from it, and its final score has to be
   * read back from the day's fixtures.
   */
  async function byDate(date) {
    if (!key) throw new Error("TheSportsDB key missing");
    const { body } = await getJson(`${V1}/${key}/eventsday.php?d=${date}&s=Soccer`);
    quota.record(undefined);
    return mine(body.events || []);
  }

  async function daily() {
    const out = [];
    for (const date of datesAround(win)) out.push(...(await byDate(date)));
    log(`GET sportsdb football ${win.back + win.ahead + 1} days -> ${out.length} matches`);
    return out;
  }

  /** V2 carries the minute and the running score; V1 only catches up at the whistle. */
  async function live() {
    if (!key) throw new Error("TheSportsDB key missing");
    const { body } = await getJson(`${V2}/livescore/soccer`, { headers: { "X-API-KEY": key } });
    quota.record(undefined);
    const rows = mine(body.livescore || []);
    log(`GET sportsdb livescore -> ${rows.length} of ours in play`);
    return rows;
  }

  return { sport: "football", daily, live, byDate };
}
