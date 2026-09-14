import { getJson } from "../http.js";
import { STATE, flag } from "../model.js";

const BASE = "https://api.jolpi.ca/ergast/f1";

export function normaliseRace(r, league, results) {
  const start = new Date(`${r.date}T${r.time || "12:00:00Z"}`).toISOString();
  const finished = Array.isArray(results) && results.length > 0;
  const now = Date.now();
  const startMs = Date.parse(start);
  let state = STATE.scheduled;
  if (finished) state = STATE.final;
  else if (now >= startMs && now < startMs + 3 * 3600e3) state = STATE.live;
  return {
    id: `f1:${r.season}:${r.round}`,
    sport: "f1",
    league: { id: league.id, name: league.name, short: league.short },
    kind: "race",
    start,
    round: `Round ${r.round}`,
    name: r.raceName,
    circuit: r.Circuit?.circuitName,
    country: r.Circuit?.Location?.country,
    status: { state, detail: finished ? "Race" : undefined },
    results: finished
      ? results.slice(0, 3).map((x) => ({
          pos: Number(x.position),
          driver: `${x.Driver.givenName[0]}. ${x.Driver.familyName}`,
          code: x.Driver.code,
          nationality: x.Driver.nationality,
          flag: flag(x.Driver.nationality),
          team: x.Constructor.name,
          gap: x.Time?.time ?? x.status,
        }))
      : undefined,
  };
}

/** { familyName: nationality } for the current season, cached 24 h. Used to put flags on OCB podiums. */
let natCache = { at: 0, map: {} };
export async function f1Nationalities(year = new Date().getUTCFullYear()) {
  if (Date.now() - natCache.at < 24 * 3600e3) return natCache.map;
  const { body } = await getJson(`${BASE}/${year}/drivers.json?limit=100`);
  const map = {};
  for (const d of body.MRData.DriverTable.Drivers) map[d.familyName] = d.nationality;
  natCache = { at: Date.now(), map };
  return map;
}

export function f1Provider(league, log = () => {}) {
  return {
    sport: "f1",
    /** Whole season calendar plus the latest classified race, 2 cheap calls. */
    async season({ year = new Date().getUTCFullYear() } = {}) {
      const { body: sched } = await getJson(`${BASE}/${year}.json?limit=40`);
      const races = sched.MRData.RaceTable.Races;
      const { body: last } = await getJson(`${BASE}/${year}/last/results.json`);
      const lastRace = last.MRData.RaceTable.Races[0];
      log(`Jolpica: ${races.length} races, last classified round ${lastRace?.round ?? "none"}`);
      return races.map((r) => normaliseRace(r, league, lastRace && lastRace.round === r.round ? lastRace.Results : undefined));
    },
  };
}
