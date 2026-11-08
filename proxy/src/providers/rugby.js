import { getJson } from "../http.js";
import { STATE } from "../model.js";
import { sameClub } from "./live-backup.js";

const BASE = "https://v1.rugby.api-sports.io";
const DAY = 86400e3;
/** The two feeds give one game the same kickoff; this is the slack the Brasileirão's backup allows. */
const KICKOFF_SLACK = 45 * 60e3;
/** A score learned from API-Sports is kept this long, over fixture lists that still have it wrong. */
const KEEP = 4 * DAY;

const utcDay = (t) => new Date(t).toISOString().slice(0, 10);

/** API-Sports' rugby statuses, in the English details the app already translates. */
const ENDED = { FT: undefined, AET: "After extra time", AW: "Awarded" };
const CALLED_OFF = { POST: "Postponed", CANC: "Cancelled", ABD: "Abandoned" };
/** Where a game in play is, when that says more than "live". */
const SAID = { HT: "Half-time", BT: "Break", ET: "Extra time" };

/**
 * One API-Sports game's status as ours. A status we have never seen after
 * "not started" is play, as sportsdb-events reads one.
 */
export function statusOf(game) {
  const short = game?.status?.short || "";
  if (Object.hasOwn(ENDED, short)) return { state: STATE.final, detail: ENDED[short] };
  if (Object.hasOwn(CALLED_OFF, short)) return { state: STATE.other, detail: CALLED_OFF[short] };
  if (!short || short === "NS") return { state: STATE.scheduled };
  if (short === "INTR") return { state: STATE.live, note: "Interrupted" };
  return { state: STATE.live, detail: Object.hasOwn(SAID, short) ? SAID[short] : undefined };
}

/**
 * The API-Sports game that is one of our fixtures: in its competition, a
 * kickoff within 45 minutes, and both sides by name ("Clermont" is "ASM
 * Clermont Auvergne", "Bordeaux Begles" is "Union Bordeaux Bègles"). Two
 * that fit are none.
 */
export function gameFor(event, games, apiLeague) {
  const kickoff = Date.parse(event.start);
  const fits = games.filter((g) => g.league?.id === apiLeague && Math.abs(g.timestamp * 1000 - kickoff) <= KICKOFF_SLACK
    && sameClub(g.teams?.home?.name, event.home?.name) && sameClub(g.teams?.away?.name, event.away?.name));
  return fits.length === 1 ? fits[0] : undefined;
}

/** What one game's answer says, as kept: its state and score, and when it was said. */
export function resultOf(game, now = Date.now()) {
  return { ...statusOf(game), home: game.scores?.home ?? null, away: game.scores?.away ?? null, at: new Date(now).toISOString() };
}

/**
 * A fixture with what API-Sports last said of its game. TheSportsDB's rugby
 * scores are typed in late, and sometimes wrong (France 34-21 Fiji on
 * 7 November, for the 54-17 that ESPN agrees with), so API-Sports' word
 * wins over theirs — except that a game it last saw in play is not kept in
 * play against a fixture list calling it over: that happens only once the
 * polls have stopped, and a game must be able to stop being live.
 */
export function withResult(event, result) {
  if (!result || result.state === STATE.scheduled) return event;
  if (result.state === STATE.live && [STATE.final, STATE.other].includes(event.status?.state)) return event;
  const scored = result.state === STATE.live || result.state === STATE.final;
  return {
    ...event,
    status: { state: result.state, clock: undefined, detail: result.detail, note: result.note },
    score: scored ? { home: result.home, away: result.away } : { home: null, away: null },
  };
}

/**
 * Rugby union. The fixtures come from TheSportsDB (`fixtures`, a
 * sportsDbSport of its own), which has every competition a week ahead with
 * the crests but no rugby at all in its livescore (checked 2026-11-08). The
 * scores come from API-Sports' free rugby plan: yesterday to tomorrow, 100
 * calls a day, and no live filter, so one call is a whole day's games,
 * finished ones included — which is how a game stops being live here.
 * `quota` counts those calls, and is the scheduler's; `meta.results` keeps
 * what they said, through restarts.
 */
export function rugbyProvider({ fixtures, leagues, key, quota, meta, log = () => {}, now = () => Date.now() }) {
  const apiLeague = new Map(leagues.map((l) => [String(l.id), l.apiSports]));
  const results = (meta.results ??= {});

  /** A call counts against the day whether or not it answers: a refusal was still spent. */
  async function gamesOn(date) {
    let answer;
    try {
      answer = await getJson(`${BASE}/games?date=${date}`, { headers: { "x-apisports-key": key } });
    } finally {
      quota.record(answer?.remaining, now());
    }
    // A refusal is an HTTP 200 with its reason in `errors`, and nothing in `response`.
    const errors = answer.body?.errors;
    if (errors && (Array.isArray(errors) ? errors.length : Object.keys(errors).length)) {
      throw new Error(`API-Sports rugby: ${JSON.stringify(errors)}`);
    }
    return answer.body?.response || [];
  }

  /**
   * Asks API-Sports for `date` when one of these fixtures is on it, the free
   * plan answers for it, and the budget allows; true once there is nothing
   * left to ask that day.
   */
  async function learn(date, events) {
    const ours = events.filter((e) => utcDay(Date.parse(e.start)) === date);
    if (!ours.length) return true;
    const today = Date.parse(`${utcDay(now())}T00:00:00Z`);
    if (!key || Math.abs(Date.parse(`${date}T00:00:00Z`) - today) > DAY || quota.spendable(now()) <= 0) return false;
    const games = await gamesOn(date);
    let found = 0;
    for (const e of ours) {
      const game = gameFor(e, games, apiLeague.get(String(e.league.id)));
      if (!game) continue;
      found += 1;
      const result = resultOf(game, now());
      if (result.state !== STATE.scheduled) results[e.id] = result;
    }
    log(`GET api-sports rugby ${date} -> ${games.length} games, ${found} of our ${ours.length} found`);
    return true;
  }

  function forget() {
    const cutoff = now() - KEEP;
    for (const [id, r] of Object.entries(results)) if (!(Date.parse(r.at) > cutoff)) delete results[id];
  }

  const told = (events) => events.map((e) => withResult(e, results[e.id]));

  /** One date's fixtures and their scores: the scheduler asks when a game it watched is gone from the day it polls. */
  async function byDate(date) {
    const events = await fixtures.byDate(date);
    await learn(date, events);
    forget();
    return told(events);
  }

  /** Today's games in whatever state, and before 03:00 UTC yesterday's: a game begun before midnight. */
  async function live() {
    const t = now();
    const dates = new Date(t).getUTCHours() < 3 ? [utcDay(t - DAY), utcDay(t)] : [utcDay(t)];
    const out = [];
    for (const date of dates) out.push(...(await byDate(date)));
    return out;
  }

  /**
   * The week from TheSportsDB with every score API-Sports gave us laid over
   * it, and once a UTC day yesterday's games settled with API-Sports, unless
   * the polls already saw them end: a proxy down through a game would
   * otherwise keep the fixture list's word for it.
   */
  async function daily(opts) {
    const events = await fixtures.daily(opts);
    const yesterday = utcDay(now() - DAY);
    const open = events.filter((e) => utcDay(Date.parse(e.start)) === yesterday && ![STATE.final, STATE.other].includes(results[e.id]?.state));
    if (meta.settled !== yesterday) {
      try {
        if (await learn(yesterday, open)) meta.settled = yesterday;
      } catch (err) {
        log(`api-sports rugby ${yesterday}: ${err.message}`); // the fixtures stand, and the next pass asks again
      }
    }
    forget();
    return Object.assign(told(events), { partial: events.partial, missing: events.missing });
  }

  return {
    sport: "rugby",
    daily,
    live,
    byDate,
    // The week is TheSportsDB's, on a budget of its own; the one API-Sports
    // call a day the pass may make checks this one itself.
    dailyCost: 0,
  };
}
