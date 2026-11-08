import { getJson } from "../http.js";
import { flagIso3 } from "../model.js";
import { TIER_CATEGORY, tiersFor, untieredOn, doublesOnly, normaliseMatch } from "./livetennis-match.js";

const BASE = "https://api.livetennisapi.com/api/public/v1";

/** Bumped when what the catalogue holds changes, so an older one is fetched again. */
// 3: the 500s' tiers stand for a category now, so a catalogue that
// filed an unlabelled 500 as null is read again.
// 4: each tournament keeps its tour and category, which find the season
// finals: the feed gives them no tier.
const CATALOGUE_VERSION = 4;

/** A month: tournament identity is stable across seasons, so the catalogue is nearly static. */
const CATALOGUE_TTL = 30 * 86400e3;

/** A tournament as the catalogue keeps it: what a heading, the calendar join and the filter need. */
export function catalogued(t, tour) {
  return { name: t.name, city: t.city, country: t.country, tier: t.tier, surface: t.surface, tour, category: t.category || TIER_CATEGORY[t.tier] || null };
}

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
  /** A call counts against the day whether or not it answers: a refusal was still spent. */
  const call = async (url) => {
    try {
      return await getJson(url, { headers });
    } finally {
      quota.record(undefined);
    }
  };
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
      // A feed that says "more" for ever must not make this a loop: twenty pages is 4,000 tournaments.
      for (let offset = 0, pages = 0; pages++ < 20; ) {
        const { body } = await call(`${BASE}/tournaments?tour=${tour}&limit=200&offset=${offset}`);
        for (const t of body?.data || []) {
          info[String(t.id)] = catalogued(t, tour);
          byId[String(t.id)] = info[String(t.id)].category;
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
    const held = await catalogue();
    const { byId, info } = held;
    // Upcoming is asked for our tiers only: unfiltered, the first 200 are
    // Challengers and ITF, and the Beijing WTA 1000 fell outside them on
    // 28 September. The live list is short enough to take whole, which
    // keeps a tournament pinned in `alsoBig` whatever its tier.
    const tiers = status === "upcoming" ? `&tier=${tiersFor(tennis.categories).join(",")}` : "";
    const { body } = await call(`${BASE}/matches?status=${status}${tiers}&limit=200`);
    const data = [...(body.data || [])];
    // A pinned tournament the feed gives no tier (Shanghai, WTA Montreal)
    // falls outside that filter, so it is asked for by id — only in its week
    // on our calendar, a call per refresh while it is on (review, build 29).
    // So are the season finals, which have no tier either: the WTA Finals'
    // matches stayed off the board until they were in play (2026-11-08).
    // A tournament's doubles id answers once and is not asked for again.
    if (status === "upcoming") {
      const today = new Date().toISOString().slice(0, 10);
      const seen = new Set(data.map((m) => m.id));
      for (const id of untieredOn(tennis.alsoBig, info, tennis.calendar, today, held.doubles)) {
        const found = (await call(`${BASE}/matches?status=upcoming&tournament_id=${id}&limit=200`)).body?.data || [];
        if (doublesOnly(found)) held.doubles = [...(held.doubles || []), id];
        for (const m of found) if (!seen.has(m.id)) { seen.add(m.id); data.push(m); }
      }
    }
    const big = bigEventFilter({ byId, ...tennis });
    const rows = data.filter(big).map((m) => {
      try {
        return normaliseMatch(m, info[String(m.tournament_id)], tennis.calendar);
      } catch (err) {
        log(`tennis: skipped match ${m?.id} (${err.message})`); // one odd row is that row's loss
        return null;
      }
    }).filter(Boolean);
    log(`GET tennis ${status} -> ${data.length} matches, ${rows.length} in ${tennis.categories.join("/")}`);
    return rows;
  }
  /** Top 25 per tour built from the ranked player list (1 call; /rankings is a paid tier). */
  async function standings() {
    if (!key) throw new Error("Live Tennis API key missing");
    const { body } = await call(`${BASE}/players?limit=200`);
    const byTour = { atp: [], wta: [] };
    for (const p of body?.data || []) {
      if (p.is_doubles_team || !p.ranking || !byTour[p.tour]) continue;
      // No country line under the name: the flag says it, and Apple Sports shows none.
      byTour[p.tour].push({ pos: p.ranking, name: p.name, value: p.ranking_points, extra: p.ranking_movement, flag: flagIso3(p.country) });
    }
    const out = {};
    for (const tour of Object.keys(byTour)) {
      const rows = byTour[tour].sort((a, b) => a.pos - b.pos).slice(0, 25);
      out[tour] = { updatedAt: new Date().toISOString(), tables: [{ id: "rankings", rows }] };
    }
    log(`GET tennis players -> rankings ATP ${out.atp.tables[0].rows.length}, WTA ${out.wta.tables[0].rows.length}`);
    return out; // keyed by league id
  }
  /**
   * One match by id — the one call the free tier answers for a match that
   * is over. The live feed drops a match when it ends, and what we last saw
   * of it was up to half an hour old: "1-0" for a match won 6-2 6-3.
   */
  async function byId(id) {
    if (!key) throw new Error("Live Tennis API key missing");
    const { info } = await catalogue();
    let body;
    try {
      ({ body } = await call(`${BASE}/matches/${String(id).replace(/^tennis:/, "")}`));
    } catch (err) {
      // A match the feed no longer knows will never answer: say so, and
      // the caller stops asking. Anything else may pass, so it throws.
      if (/HTTP 404/.test(err.message)) return null;
      throw err;
    }
    return body?.id ? normaliseMatch(body, info[String(body.tournament_id)], tennis.calendar) : null;
  }
  return {
    sport: "tennis",
    standings,
    byId,
    /** Orphans of the live feed are over (no `completed` listing on the free tier). */
    finalizeOrphans: true,
    /** Matches under way are only in the live feed: poll it all day (every 30 min). */
    alwaysLive: true,
    daily: () => list("upcoming"),
    live: () => list("live"),
  };
}
