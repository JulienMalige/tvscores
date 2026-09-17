import { getJson } from "../http.js";
import { STATE, team } from "../model.js";

const V1 = "https://www.thesportsdb.com/api/v1/json";
const V2 = "https://www.thesportsdb.com/api/v2/json";

const FINAL = new Set(["FT", "AET", "PEN", "AOT"]);
/**
 * How long after kickoff a fixture still marked "not started" stops being
 * believed. The data is crowd-sourced and some matches are simply never
 * updated: Botafogo v Grêmio sat at "NS, no score" for four hours while the
 * Libertadores match beside it ticked over every minute. Showing its kickoff
 * time by then says the game is still to come, which is the one thing we know
 * it is not.
 */
const BELIEVE_NS_FOR = 3 * 3600e3;
const NOT_PLAYED = new Set(["PPD", "POSTP", "CANC", "ABD"]);

/** The English detail strings the app's string catalogue already knows. */
const DETAIL = {
  HT: "Half-time", ET: "Extra time", BT: "Break", P: "Penalties",
  AET: "After extra time", PEN: "After penalties", AOT: "After overtime",
  PPD: "Postponed", POSTP: "Postponed", CANC: "Cancelled", ABD: "Abandoned",
};

/** Quarters read as they do on a scoreboard; a football minute reads as "67'". */
const PERIOD = { Q1: "1st", Q2: "2nd", Q3: "3rd", Q4: "4th", OT: "OT" };

/**
 * One entry per sport we take from this provider: the name its schedule
 * endpoint wants, the path its livescore endpoint lives at, and whether its
 * teams are known by nickname ("Lions") or in full ("Manchester City").
 */
const SPORTS = {
  football: { feed: "Soccer", live: "soccer", nick: false },
  nfl: { feed: "American Football", live: "americanfootball", nick: true },
  nba: { feed: "Basketball", live: "basketball", nick: true },
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

/**
 * Anything playing that is not a known ending is live.
 *
 * Written that way round on purpose: the status vocabularies differ by sport
 * and are not documented in full, so a quarter label we have never seen must
 * read as a game in progress rather than quietly as "scheduled".
 */
export function stateOf(row, now = Date.now()) {
  const short = row.strStatus || "";
  if (row.strPostponed === "yes" || NOT_PLAYED.has(short)) return STATE.other;
  if (!short || short === "NS") {
    const start = Date.parse(startOf(row) || "");
    return Number.isFinite(start) && now - start > BELIEVE_NS_FOR ? STATE.other : STATE.scheduled;
  }
  if (FINAL.has(short)) return STATE.final;
  return STATE.live;
}

export function normaliseEvent(row, league, sport = "football", now = Date.now()) {
  const start = startOf(row);
  if (!start) return null;
  const short = row.strStatus || "";
  const state = stateOf(row, now);
  // Kicked off hours ago and still "not started": the provider lost track of
  // it, and saying so is better than showing a kickoff time that has passed.
  // A postponed match says "NS" as well, and it knows why — that wins.
  const called = row.strPostponed === "yes" || NOT_PLAYED.has(short);
  const lost = state === STATE.other && !called && (!short || short === "NS");
  const { nick } = SPORTS[sport];
  // `strProgress` is where the game is: a minute in football, the period clock
  // elsewhere. Neither means anything while the teams are off the pitch.
  const stopped = ["HT", "BT", "P"].includes(short);
  const clock = state !== STATE.live || stopped
    ? undefined
    : nick
      ? [PERIOD[short], row.strProgress].filter(Boolean).join(" ") || undefined
      : row.strProgress
        ? `${row.strProgress}'`
        : undefined;
  return {
    id: `${sport}:tsdb:${row.idEvent}`,
    sport,
    league: { id: league.id, name: league.name, short: league.short },
    kind: "match",
    start,
    round: row.intRound ? `Round ${row.intRound}` : undefined,
    status: { state, clock, detail: lost ? "No update" : row.strPostponed === "yes" ? "Postponed" : DETAIL[short] },
    home: team(row.strHomeTeam, undefined, { nick, logo: row.strHomeTeamBadge || undefined }),
    away: team(row.strAwayTeam, undefined, { nick, logo: row.strAwayTeamBadge || undefined }),
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
 * A league table row. `intRank` is the provider's own ordering, so a league
 * that separates on goal difference or head-to-head is already sorted.
 */
function standingsRow(r) {
  const played = Number(r.intPlayed || 0);
  const record = [r.intWin, r.intDraw, r.intLoss].every((v) => v != null)
    ? `${played} · ${r.intWin}-${r.intDraw}-${r.intLoss}`
    : `${played} played`;
  return {
    pos: Number(r.intRank),
    name: r.strTeam,
    sub: record,
    value: r.intPoints == null ? null : Number(r.intPoints),
    logo: r.strBadge || undefined,
  };
}

/**
 * A team sport from TheSportsDB: one call per day of the window, filtered to
 * the competitions we show. The paid key returns up to 1,500 events for a
 * date, which is why a seven-day Upcoming costs one call per day rather than
 * a season fixture list per league — and why a competition costs nothing.
 */
export function sportsDbSport({ sport, key, leagues, window: win, quota, seasons = {}, log = () => {} }) {
  const { feed, live: livePath } = SPORTS[sport];
  const byId = new Map(leagues.map((l) => [String(l.id), l]));
  const mine = (rows) => {
    const keep = rows.filter((r) => byId.has(String(r.idLeague)));
    // Every fixture names its own season, so the table lookup never needs a
    // call of its own — nor a hardcoded year that goes stale each August.
    for (const r of keep) if (r.strSeason) seasons[String(r.idLeague)] = r.strSeason;
    return keep.map((r) => normaliseEvent(r, byId.get(String(r.idLeague)), sport)).filter(Boolean);
  };

  /**
   * One date. The scheduler asks for this when a match it was watching leaves
   * the live feed: the livescore endpoint only lists games in progress, so a
   * match that ends simply vanishes from it, and its final score has to be
   * read back from the day's fixtures.
   */
  async function byDate(date) {
    if (!key) throw new Error("TheSportsDB key missing");
    const { body } = await getJson(`${V1}/${key}/eventsday.php?d=${date}&s=${encodeURIComponent(feed)}`);
    quota.record(undefined);
    return mine(body?.events || []);
  }

  async function daily() {
    const out = [];
    for (const date of datesAround(win)) out.push(...(await byDate(date)));
    log(`GET sportsdb ${sport} ${win.back + win.ahead + 1} days -> ${out.length} matches`);
    return out;
  }

  /** V2 carries the minute and the running score; V1 only catches up at the whistle. */
  async function live() {
    if (!key) throw new Error("TheSportsDB key missing");
    const { body } = await getJson(`${V2}/livescore/${livePath}`, { headers: { "X-API-KEY": key } });
    quota.record(undefined);
    const rows = mine(body?.livescore || []);
    log(`GET sportsdb livescore ${livePath} -> ${rows.length} of ours in play`);
    return rows;
  }

  /**
   * The season a table is asked for. Fixtures name their own season, so this
   * is usually already known and free; a proxy that has not fetched fixtures
   * yet asks the league itself, once, and keeps the answer.
   */
  async function currentSeason(id) {
    const { body } = await getJson(`${V1}/${key}/lookupleague.php?id=${id}`);
    quota.record(undefined);
    const season = (body?.leagues || [])[0]?.strCurrentSeason;
    if (season) seasons[String(id)] = season;
    return season;
  }

  /**
   * One league table per competition that has one. A knockout cup has no
   * table and a season that has not started has no rows: both come back
   * empty, and an empty table is dropped rather than shown as a blank page.
   */
  async function standings(only) {
    if (!key) throw new Error("TheSportsDB key missing");
    const out = {};
    for (const league of leagues) {
      if (only && !only.has(String(league.id))) continue;
      const season = seasons[String(league.id)] || (await currentSeason(league.id));
      if (!season) continue;
      const { body } = await getJson(`${V1}/${key}/lookuptable.php?l=${league.id}&s=${encodeURIComponent(season)}`);
      quota.record(undefined);
      const rows = (body?.table || []).map(standingsRow);
      if (rows.length) out[league.id] = { updatedAt: new Date().toISOString(), tables: [{ id: "table", rows }] };
    }
    log(`GET sportsdb ${sport} tables -> ${Object.keys(out).length} of ${leagues.length}`);
    return out;
  }

  return { sport, daily, live, byDate, standings, standingsFollowResults: true, dailyCost: win.back + win.ahead + 1 };
}
