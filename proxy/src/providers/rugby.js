import { getJson } from "../http.js";
import { STATE } from "../model.js";
import { sameClub } from "./live-backup.js";

const BASE = "https://v1.rugby.api-sports.io";
const DAY = 86400e3;
/** The two feeds give one game the same kickoff; this is the slack the Brasileirão's backup allows. */
const KICKOFF_SLACK = 45 * 60e3;
/** A score learned from API-Sports is kept this long, over fixture lists that still have it wrong. */
const KEEP = 4 * DAY;
/**
 * A day's answer is used again within this: the scheduler asks for the day
 * of a game past its kickoff right after the round that just asked for it.
 * Under the five minutes between rounds.
 */
const HEARD_FOR = 4 * 60e3;
/** No rugby game is still being played this long after its kickoff, extra time and all. */
const PLAYED_WITHIN = 3 * 3600e3;

const utcDay = (t) => new Date(t).toISOString().slice(0, 10);

/**
 * API-Sports' rugby statuses, in the English details the app already
 * translates. Its documentation would not be fetched (2026-11-08), so these
 * are the ones its football and handball feeds share, and FT and NS seen.
 */
const ENDED = { FT: undefined, AET: "After extra time", AW: "Awarded" };
const CALLED_OFF = { POST: "Postponed", CANC: "Cancelled", ABD: "Abandoned" };
/** Where a game in play is, when that says more than "live". */
const SAID = { HT: "Half-time", BT: "Break", ET: "Extra time" };

/**
 * One API-Sports game's status as ours, or nothing when it says nothing we
 * can use. Anything but an ending, a game called off or "not started" is
 * play — the halves and pauses, and a status never seen, as sportsdb-events
 * reads one — but not three hours after the kickoff: by then that is an
 * ending we do not know or a feed that stopped, and no word at all.
 */
export function statusOf(game, now = Date.now()) {
  const short = game?.status?.short || "";
  if (Object.hasOwn(ENDED, short)) return { state: STATE.final, detail: ENDED[short] };
  if (Object.hasOwn(CALLED_OFF, short)) return { state: STATE.other, detail: CALLED_OFF[short] };
  if (!short || short === "NS") return { state: STATE.scheduled };
  if (now - (game.timestamp ?? 0) * 1000 >= PLAYED_WITHIN) return undefined;
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

/** What one game's answer says, as kept: its state and score, and when it was said; nothing when it says nothing. */
export function resultOf(game, now = Date.now()) {
  const status = statusOf(game, now);
  return status && { ...status, home: game.scores?.home ?? null, away: game.scores?.away ?? null, at: new Date(now).toISOString() };
}

/**
 * A fixture with what API-Sports last said of its game. TheSportsDB's rugby
 * scores are typed in late, and sometimes wrong (France 34-21 Fiji on
 * 7 November, for the 54-17 that ESPN agrees with), so API-Sports' word
 * wins over theirs, with two exceptions. A game the fixture list has seen
 * end is over, whatever API-Sports last said of it in play or called off:
 * the polls stopped, or it was played later. And a game must be able to
 * stop being live: one last seen in play is not kept so against a list
 * calling it off or lost.
 */
export function withResult(event, result) {
  if (!result || result.state === STATE.scheduled) return event;
  if (event.status?.state === STATE.final && result.state !== STATE.final) return event;
  if (result.state === STATE.live && event.status?.state === STATE.other) return event;
  const scored = result.state === STATE.live || result.state === STATE.final;
  return {
    ...event,
    status: { state: result.state, clock: undefined, detail: result.detail, note: result.note },
    score: scored ? { home: result.home, away: result.away } : { home: null, away: null },
  };
}

/**
 * Rugby union. The fixtures come from TheSportsDB (`fixtures`, a
 * sportsDbSport of its own, counted by `fixturesQuota`), which has every
 * competition a week ahead with the crests but no rugby at all in its
 * livescore (checked 2026-11-08). The scores come from API-Sports' free rugby
 * plan: yesterday to tomorrow, 100 calls a day, and no live filter, so one
 * call is a whole day's games, finished ones included — which is how a game
 * stops being live here. `quota` counts those calls, and is the scheduler's;
 * `meta.results` keeps what they said, through restarts.
 */
export function rugbyProvider({ fixtures, fixturesQuota, leagues, key, quota, meta, log = () => {}, now = () => Date.now() }) {
  const apiLeague = new Map(leagues.map((l) => [String(l.id), l.apiSports]));
  const results = (meta.results ??= {});
  /** date -> { at, games }: the last answer for each day, for HEARD_FOR. */
  const heard = new Map();

  /** The fixtures' own budget, a ceiling like football's: `need` calls left after the reserve. */
  function fixturesLeft(need) {
    if (fixturesQuota && fixturesQuota.spendable(now()) < need) throw new Error("TheSportsDB rugby: the day's budget is spent");
  }

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
    const games = answer.body?.response || [];
    for (const [day, h] of heard) if (now() - h.at >= HEARD_FOR) heard.delete(day);
    heard.set(date, { at: now(), games });
    return games;
  }

  /**
   * What API-Sports says of these fixtures' games on `date`: asked when one
   * of them has not ended, the free plan answers for the day and the budget
   * allows, unless the day was asked just now. True once there is nothing
   * left to ask that day.
   */
  async function learn(date, events) {
    const open = events.filter((e) => utcDay(Date.parse(e.start)) === date && results[e.id]?.state !== STATE.final);
    if (!open.length) return true;
    const today = Date.parse(`${utcDay(now())}T00:00:00Z`);
    if (!key || Math.abs(Date.parse(`${date}T00:00:00Z`) - today) > DAY) return false;
    const recent = heard.get(date);
    const fresh = recent && now() - recent.at < HEARD_FOR;
    if (!fresh && quota.spendable(now()) <= 0) return false;
    const games = fresh ? recent.games : await gamesOn(date);
    let found = 0;
    for (const e of open) {
      const game = gameFor(e, games, apiLeague.get(String(e.league.id)));
      if (!game) continue;
      found += 1;
      // Its word now replaces its word before: a game called off and set
      // again is "not started" once more, and that is nothing to lay over.
      const result = resultOf(game, now());
      if (result && result.state !== STATE.scheduled) results[e.id] = result;
      else delete results[e.id];
    }
    if (!fresh) log(`GET api-sports rugby ${date} -> ${games.length} games, ${found} of our ${open.length} open found`);
    return true;
  }

  function forget() {
    const cutoff = now() - KEEP;
    for (const [id, r] of Object.entries(results)) if (!(Date.parse(r.at) > cutoff)) delete results[id];
  }

  const told = (events) => events.map((e) => withResult(e, results[e.id]));

  /** One date's fixtures and their scores: the scheduler asks when a game it watched is gone from the day it polls. */
  async function byDate(date) {
    fixturesLeft(1);
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
   * otherwise keep the fixture list's word for it. Only a whole pass that
   * got yesterday settles it: a retry asks for other days, and a day that
   * failed has no fixtures to ask about.
   */
  async function daily(opts) {
    fixturesLeft(fixtures.dailyCost ?? 1);
    const events = await fixtures.daily(opts);
    const yesterday = utcDay(now() - DAY);
    if (meta.settled !== yesterday && !opts?.dates?.length && !events.missing?.includes(yesterday)) {
      try {
        if (await learn(yesterday, events)) meta.settled = yesterday;
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
    // The week is TheSportsDB's, on its own budget, which daily() checks;
    // the one API-Sports call a day the pass may make checks this one.
    dailyCost: 0,
  };
}
