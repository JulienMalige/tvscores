import { STATE, flagIso2, flagIso3 } from "../model.js";
import { calendarEntry } from "./tennis-calendar.js";

const TOURS = {
  atp: { id: "atp", name: "ATP Tour", short: "ATP" },
  wta: { id: "wta", name: "WTA Tour", short: "WTA" },
};

/**
 * The category a tournament's tier stands for, when the feed gives a tier
 * and no category. It does that for some of the very events we want — the
 * WTA 1000 in Beijing came with `category: null, tier: "wta_1000"` on
 * 2026-09-28 — and a missing category drops a tournament from the list.
 */
export const TIER_CATEGORY = {
  grand_slam: "grand_slam",
  atp_1000: "masters_1000",
  wta_1000: "wta_1000",
  atp_500: "atp_500",
  wta_500: "wta_500",
  atp_finals: "tour_finals",
  wta_finals: "tour_finals",
  tour_finals: "tour_finals",
};

function player(p) {
  const name = p?.name || "TBD";
  const surname = name.split(/\s+/).at(-1) || name;
  return { name, short: surname.slice(0, 3).toUpperCase(), nick: surname, country: p?.country?.toUpperCase(), flag: flagIso3(p?.country) };
}

/**
 * `score.games` is one array per player, each with a games count per set:
 * `[[6, 5, 6], [4, 7, 5]]` is 6-4, 5-7, 6-5. The two arrays can differ in
 * length while a set is being entered, so every read is guarded.
 */
function setPairs(score) {
  const [p1, p2] = score?.games || [];
  if (!Array.isArray(p1) && !Array.isArray(p2)) return [];
  const count = Math.max(p1?.length || 0, p2?.length || 0);
  return Array.from({ length: count }, (_, i) => [p1?.[i] ?? 0, p2?.[i] ?? 0]);
}

/** "Set 3 · 4-2" from the score block; undefined when no games are known. */
export function liveClock(score) {
  const sets = setPairs(score);
  if (!sets.length) return undefined;
  const [a, b] = sets[sets.length - 1];
  return `Set ${sets.length} · ${a}-${b}`;
}

/** "7-5 6-7 3-2" summary of every set, for the detail line once a match is final. */
export function setsLine(score) {
  const sets = setPairs(score);
  if (!sets.length) return undefined;
  return sets.map(([a, b]) => `${a}-${b}`).join(" ");
}

/** "wta_1000" -> "WTA 1000", "grand_slam" -> "Grand Slam"; undefined when unknown. */
export function tierLabel(tier) {
  if (!tier) return undefined;
  return String(tier).split("_").filter(Boolean).map((w) => (/^(atp|wta|itf)$/.test(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1))).join(" ");
}

/**
 * The tournament a match belongs to, as a heading can show it: its name,
 * town, country and flag (the proxy's flat flags, as a race weekend's), its
 * tier and surface, and its dates. The feed has no logo, no sponsor's name
 * and no dates — the China Open is "Beijing" — so the name and the dates come
 * from our calendar when it has the tournament, and the name falls back to
 * the feed's own when it does not.
 */
function competitionOf(info, entry) {
  if (!info?.name) return undefined;
  const country = info.country || entry?.country;
  return {
    name: entry?.name || info.name,
    city: info.city || entry?.city || undefined,
    country: /^[A-Za-z]{2}$/.test(country || "") ? country.toUpperCase() : undefined,
    flag: flagIso2(country),
    tier: tierLabel(info.tier || entry?.tier),
    surface: info.surface || undefined,
    start: entry?.start,
    end: entry?.end,
  };
}

/** "WTA Beijing - Round of 64" -> "Round of 64": the tournament is said already. */
export function roundOf(round) {
  if (!round) return undefined;
  const cut = round.lastIndexOf(" - ");
  const bare = cut >= 0 ? round.slice(cut + 3) : round;
  // "1/64-finals" is the feed's; a draw of 128 is how people say it.
  const part = bare.match(/^1\/(\d+)-finals?$/i);
  if (part) {
    const n = Number(part[1]) * 2;
    return n === 8 ? "Quarter-final" : n === 4 ? "Semi-final" : `Round of ${n}`;
  }
  return bare;
}

/** The feed's tiers for the categories we show, for its `tier=` filter. */
export function tiersFor(categories) {
  const wanted = new Set(categories);
  return FEED_TIERS.filter((t) => wanted.has(TIER_CATEGORY[t]));
}

/** The tier names the feed's filter accepts; "tour_finals" is only ours (HTTP 400). */
const FEED_TIERS = ["grand_slam", "atp_1000", "wta_1000", "atp_500", "wta_500", "atp_finals", "wta_finals"];

/** Pinned tournaments with no tier the feed can filter on, on our calendar today. */
export function untieredOn(pinned = [], info = {}, calendar = [], day) {
  return pinned.map(String).filter((id) => info[id] && !FEED_TIERS.includes(info[id].tier)
    && ["atp", "wta"].some((tour) => calendarEntry(calendar, { tour, info: info[id], day })));
}

/** The feed's winner, 1 or 2, by side: a retirement can leave the winner behind on sets. */
const WINNER = { 1: "home", 2: "away" };

export function normaliseMatch(m, info, calendar = []) {
  const league = TOURS[m.tour];
  if (!league || m.is_doubles) return null;
  // A time is a string or an epoch. None, or one that is not a time, cannot place an
  // upcoming match on a day, and inventing "now" would move it on every poll; a match
  // already in play is worth showing whatever its payload forgot, so it keeps the poll's.
  const raw = m.scheduled_time ?? m.live_at;
  let when = typeof raw === "number" ? raw : Date.parse(raw);
  if (!Number.isFinite(when)) {
    if (m.status !== "live") return null;
    when = Date.now();
  }
  const start = new Date(when).toISOString();
  const entry = info ? calendarEntry(calendar, { tour: m.tour, info, day: start.slice(0, 10) }) : undefined;
  let state = STATE.other;
  if (m.status === "upcoming") state = STATE.scheduled;
  else if (m.status === "live") state = STATE.live;
  else if (m.status === "completed") state = STATE.final;
  const interrupted = m.event_status === "Interrupted";
  const sets = setsLine(m.score);
  // The round is the caption over the row now ("Beijing · Round of 64"):
  // under the time as well, it said the same thing twice (Julien, build 28).
  const detail = state === STATE.final ? sets : undefined;
  // A match we never saw in play carries a 0-0 score block from the upcoming
  // feed. Showing "Final 0-0" would be a lie, so report no score instead.
  const known = state === STATE.live || (state === STATE.final && sets !== undefined);
  return {
    id: `tennis:${m.id}`,
    sport: "tennis",
    league,
    kind: "match",
    start,
    round: roundOf(m.round),
    tournament: m.tournament,
    competition: competitionOf(info, entry),
    status: { state, clock: state === STATE.live && !interrupted ? liveClock(m.score) : undefined, detail, note: interrupted ? "Interrupted" : undefined },
    home: player(m.players?.p1),
    away: player(m.players?.p2),
    // Sets won, and the games of every set for the row to show "6-2 6-3"
    // (Julien, build 31: "1-0" said nothing).
    score: known
      ? { home: m.score?.sets?.[0] ?? null, away: m.score?.sets?.[1] ?? null, sets: setPairs(m.score), winner: WINNER[m.winner] }
      : { home: null, away: null },
  };
}
