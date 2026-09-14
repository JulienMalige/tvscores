import { getJson } from "../http.js";
import { STATE, flagIso3 } from "../model.js";

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

export function normaliseMatch(m) {
  const league = TOURS[m.tour];
  if (!league || m.is_doubles) return null;
  let state = STATE.other;
  if (m.status === "upcoming") state = STATE.scheduled;
  else if (m.status === "live") state = STATE.live;
  else if (m.status === "completed") state = STATE.final;
  const interrupted = m.event_status === "Interrupted";
  const sets = setsLine(m.score);
  const detail = state === STATE.final ? sets : m.round || undefined;
  // A match we never saw in play carries a 0-0 score block from the upcoming
  // feed. Showing "Final 0-0" would be a lie, so report no score instead.
  const known = state === STATE.live || (state === STATE.final && sets !== undefined);
  return {
    id: `tennis:${m.id}`,
    sport: "tennis",
    league,
    kind: "match",
    start: new Date(m.scheduled_time || m.live_at || Date.now()).toISOString(),
    round: m.round,
    tournament: m.tournament,
    status: { state, clock: state === STATE.live && !interrupted ? liveClock(m.score) : undefined, detail, note: interrupted ? "Interrupted" : undefined },
    home: player(m.players?.p1),
    away: player(m.players?.p2),
    score: known ? { home: m.score?.sets?.[0] ?? null, away: m.score?.sets?.[1] ?? null } : { home: null, away: null },
  };
}

/**
 * livetennisapi.com free tier: 100 calls/day, 30/min, `status=live|upcoming` only.
 * daily() = the upcoming picture (1 call); live() = matches in play (1 call).
 */
export function tennisProvider({ key, quota, log = () => {} }) {
  const headers = { authorization: `Bearer ${key}` };
  async function list(status) {
    if (!key) throw new Error("Live Tennis API key missing");
    const { body } = await getJson(`${BASE}/matches?status=${status}&limit=200`, { headers });
    quota.record(undefined);
    const rows = (body.data || []).map(normaliseMatch).filter(Boolean);
    log(`GET tennis ${status} -> ${body.data?.length ?? 0} matches, ${rows.length} ATP/WTA singles`);
    return rows;
  }
  /** Top 25 per tour built from the ranked player list (1 call; /rankings is a paid tier). */
  async function standings() {
    if (!key) throw new Error("Live Tennis API key missing");
    const { body } = await getJson(`${BASE}/players?limit=200`, { headers });
    quota.record(undefined);
    const byTour = { atp: [], wta: [] };
    for (const p of body.data || []) {
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
    daily: () => list("upcoming"),
    live: () => list("live"),
  };
}
