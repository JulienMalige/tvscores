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

/** "Set 3 · 4-2" from the score block; undefined when no games are known. */
export function liveClock(score) {
  if (!score?.games?.length) return undefined;
  const setNo = score.games.length;
  const [g1, g2] = score.games[setNo - 1];
  return `Set ${setNo} · ${g1}-${g2}`;
}

/** "7-5 6-7 3-2" summary of every set, for the detail line once a match is final. */
export function setsLine(score) {
  if (!score?.games?.length) return undefined;
  return score.games.map(([a, b]) => `${a}-${b}`).join(" ");
}

export function normaliseMatch(m) {
  const league = TOURS[m.tour];
  if (!league || m.is_doubles) return null;
  let state = STATE.other;
  if (m.status === "upcoming") state = STATE.scheduled;
  else if (m.status === "live") state = STATE.live;
  else if (m.status === "completed") state = STATE.final;
  const interrupted = m.event_status === "Interrupted";
  const detail = state === STATE.final ? setsLine(m.score) : [m.round, interrupted ? "Interrupted" : null].filter(Boolean).join(" · ") || undefined;
  return {
    id: `tennis:${m.id}`,
    sport: "tennis",
    league,
    kind: "match",
    start: new Date(m.scheduled_time || m.live_at || Date.now()).toISOString(),
    round: m.round,
    tournament: m.tournament,
    status: { state, clock: state === STATE.live && !interrupted ? liveClock(m.score) : undefined, detail },
    home: player(m.players?.p1),
    away: player(m.players?.p2),
    score: { home: m.score?.sets?.[0] ?? null, away: m.score?.sets?.[1] ?? null },
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
