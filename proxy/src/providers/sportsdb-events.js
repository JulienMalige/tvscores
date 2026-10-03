import { STATE, team } from "../model.js";

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
// Every spelling of "this was not played" we have seen. `PST` cost us a
// postponed match shown as live — and, because a live game is bucketed into
// today whatever its date, yesterday's postponement appeared as today's game.
const NOT_PLAYED = new Set(["PPD", "PST", "POST", "POSTP", "CANC", "CANCL", "ABD", "AWD", "WO"]);

/** The English detail strings the app's string catalogue already knows. */
const DETAIL = {
  HT: "Half-time", ET: "Extra time", BT: "Break", P: "Penalties",
  AET: "After extra time", PEN: "After penalties", AOT: "After overtime",
  PPD: "Postponed", PST: "Postponed", POST: "Postponed", POSTP: "Postponed",
  CANC: "Cancelled", CANCL: "Cancelled", ABD: "Abandoned",
  AWD: "Awarded", WO: "Walkover",
};

/** Quarters read as they do on a scoreboard; a football minute reads as "67'". */
const PERIOD = { Q1: "1st", Q2: "2nd", Q3: "3rd", Q4: "4th", OT: "OT" };

/**
 * One entry per sport we take from this provider: the name its schedule
 * endpoint wants, the path its livescore endpoint lives at, and whether its
 * teams are known by nickname ("Lions") or in full ("Manchester City").
 */
export const SPORTS = {
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
  const start = Date.parse(startOf(row) || "");
  if (!short || short === "NS") {
    return Number.isFinite(start) && now - start > BELIEVE_NS_FOR ? STATE.other : STATE.scheduled;
  }
  if (FINAL.has(short)) return STATE.final;
  // Treating an unknown status as live is deliberate — a quarter we have never
  // seen is a game being played — but nothing is being played before kickoff.
  if (Number.isFinite(start) && now < start - 15 * 60e3) return STATE.scheduled;
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

/** A youth or women's side, by the name the feed gives it: "Serbia U19", "Brazil Women". */
export function isYouth(r) {
  return [r.strHomeTeam, r.strAwayTeam].some((n) => /\bU-?\d{2}\b|\bWomen\b/i.test(n || ""));
}
