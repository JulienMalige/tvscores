import { getJson } from "../http.js";
import { STATE, flagIso2, flagIso3 } from "../model.js";

const BASE = "https://api.livetennisapi.com/api/public/v1";
const TOURS = {
  atp: { id: "atp", name: "ATP Tour", short: "ATP" },
  wta: { id: "wta", name: "WTA Tour", short: "WTA" },
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
 * its country's flag (the proxy's flat flags, as a race weekend's), its tier
 * and surface. The feed has no logo and no sponsor's name — the China Open
 * is "Beijing" — so the name is the feed's own.
 */
function competitionOf(info) {
  if (!info?.name) return undefined;
  return { name: info.name, city: info.city || undefined, flag: flagIso2(info.country), tier: tierLabel(info.tier), surface: info.surface || undefined };
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
const FEED_TIERS = ["grand_slam", "atp_1000", "wta_1000", "atp_finals", "wta_finals"];

export function normaliseMatch(m, info) {
  const league = TOURS[m.tour];
  if (!league || m.is_doubles) return null;
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
    start: new Date(m.scheduled_time || m.live_at || Date.now()).toISOString(),
    round: roundOf(m.round),
    tournament: m.tournament,
    competition: competitionOf(info),
    status: { state, clock: state === STATE.live && !interrupted ? liveClock(m.score) : undefined, detail, note: interrupted ? "Interrupted" : undefined },
    home: player(m.players?.p1),
    away: player(m.players?.p2),
    score: known ? { home: m.score?.sets?.[0] ?? null, away: m.score?.sets?.[1] ?? null } : { home: null, away: null },
  };
}

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
  atp_finals: "tour_finals",
  wta_finals: "tour_finals",
  tour_finals: "tour_finals",
};

/** Bumped when what the catalogue holds changes, so an older one is fetched again. */
const CATALOGUE_VERSION = 2;

/** A month: tournament identity is stable across seasons, so the catalogue is nearly static. */
const CATALOGUE_TTL = 30 * 86400e3;

/**
 * Keeps only the matches of a tournament whose category is one we want.
 *
 * A tournament the feed could not label carries `null`, which it documents as
 * "never derived from the name" — so an unknown tournament is dropped rather
 * than guessed at. That errs towards showing too little, which on a television
 * is the right way to be wrong.
 */
export function bigEventFilter({ byId, categories, includeQualifying, alsoBig = [] }) {
  const wanted = new Set(categories);
  const pinned = new Set(alsoBig.map(String));
  return (m) => {
    if (!includeQualifying && m.is_qualifying) return false;
    const id = String(m.tournament_id);
    return pinned.has(id) || wanted.has(byId[id]);
  };
}

/**
 * livetennisapi.com free tier: 100 calls/day, 30/min, `status=live|upcoming` only.
 * daily() = the upcoming picture (1 call); live() = matches in play (1 call).
 */
export function tennisProvider({ key, quota, meta = {}, tennis, log = () => {} }) {
  const headers = { authorization: `Bearer ${key}` };
  /**
   * `tournament_id` -> category, for the two tours we show. The endpoint has no
   * category filter, so the tours are paged once and kept: a few calls a month
   * against a 100-a-day budget.
   */
  async function catalogue() {
    const held = meta.tournaments;
    // A catalogue from an earlier version of this code is fetched again.
    if (held?.version === CATALOGUE_VERSION && Date.now() - new Date(held.at).getTime() < CATALOGUE_TTL) return held;
    const byId = {};
    const info = {};
    for (const tour of ["atp", "wta"]) {
      for (let offset = 0; ; ) {
        const { body } = await getJson(`${BASE}/tournaments?tour=${tour}&limit=200&offset=${offset}`, { headers });
        quota.record(undefined);
        for (const t of body?.data || []) {
          byId[String(t.id)] = t.category || TIER_CATEGORY[t.tier] || null;
          info[String(t.id)] = { name: t.name, city: t.city, country: t.country, tier: t.tier, surface: t.surface };
        }
        if (!body?.meta?.has_more) break;
        offset += body.data?.length || 200;
      }
    }
    meta.tournaments = { version: CATALOGUE_VERSION, at: new Date().toISOString(), byId, info };
    log(`GET tennis tournaments -> ${Object.keys(byId).length} catalogued`);
    return meta.tournaments;
  }

  async function list(status) {
    if (!key) throw new Error("Live Tennis API key missing");
    const { byId, info } = await catalogue();
    // Upcoming is asked for our tiers only: unfiltered, the first 200 are
    // Challengers and ITF, and the Beijing WTA 1000 fell outside them on
    // 28 September. The live list is short enough to take whole, which
    // keeps a tournament pinned in `alsoBig` whatever its tier.
    const tiers = status === "upcoming" ? `&tier=${tiersFor(tennis.categories).join(",")}` : "";
    const { body } = await getJson(`${BASE}/matches?status=${status}${tiers}&limit=200`, { headers });
    quota.record(undefined);
    const big = bigEventFilter({ byId, ...tennis });
    const rows = (body.data || []).filter(big).map((m) => normaliseMatch(m, info[String(m.tournament_id)])).filter(Boolean);
    log(`GET tennis ${status} -> ${body?.data?.length ?? 0} matches, ${rows.length} in ${tennis.categories.join("/")}`);
    return rows;
  }
  /** Top 25 per tour built from the ranked player list (1 call; /rankings is a paid tier). */
  async function standings() {
    if (!key) throw new Error("Live Tennis API key missing");
    const { body } = await getJson(`${BASE}/players?limit=200`, { headers });
    quota.record(undefined);
    const byTour = { atp: [], wta: [] };
    for (const p of body?.data || []) {
      if (p.is_doubles_team || !p.ranking || !byTour[p.tour]) continue;
      byTour[p.tour].push({ pos: p.ranking, name: p.name, sub: p.country?.toUpperCase(), value: p.ranking_points, extra: p.ranking_movement, flag: flagIso3(p.country) });
    }
    const out = {};
    for (const tour of Object.keys(byTour)) {
      const rows = byTour[tour].sort((a, b) => a.pos - b.pos).slice(0, 25);
      out[tour] = { updatedAt: new Date().toISOString(), tables: [{ id: "rankings", rows }] };
    }
    log(`GET tennis players -> rankings ATP ${out.atp.tables[0].rows.length}, WTA ${out.wta.tables[0].rows.length}`);
    return out; // keyed by league id
  }
  return {
    sport: "tennis",
    standings,
    /** Orphans of the live feed are over (no `completed` listing on the free tier). */
    finalizeOrphans: true,
    /** Matches under way are only in the live feed: poll it all day (every 30 min). */
    alwaysLive: true,
    daily: () => list("upcoming"),
    live: () => list("live"),
  };
}
