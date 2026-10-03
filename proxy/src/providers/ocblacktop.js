import { getJson } from "../http.js";
import { STATE, flag, flagIso2, shortName } from "../model.js";
import { classify } from "./ocb-rows.js";
import { sessionResults } from "./ocb-sessions.js";

export { lapSeconds } from "./ocb-rows.js";

const BASE = "https://api.ocblacktop.com/v1";
const RACE_HOURS = 3;

/** Orange Cat Blacktop: one calendar-and-results API for every motorsport. */
export function normaliseEvent(e, { league, results, nationalities = {}, now = Date.now() }) {
  const race = (e.schedule || []).find((s) => s.type === "race");
  if (!race) return null; // testing weeks have no race session
  const start = new Date(race.startTime).toISOString();
  const startMs = Date.parse(start);
  let state = STATE.scheduled;
  if (race.status === "cancelled" || e.status === "cancelled") state = STATE.other;
  else if (race.status === "completed") state = STATE.final;
  else if (now >= startMs && now < startMs + RACE_HOURS * 3600e3) state = STATE.live;
  const classification = classify(results, nationalities);
  return {
    id: `${league.id}:ocb:${e.id}`,
    sport: league.id,
    league,
    kind: "race",
    start,
    round: undefined,
    name: titleCase(e.name),
    circuit: e.location?.name,
    country: e.location?.country?.name,
    flag: flagIso2(e.location?.country?.twoCode),
    // The weekend's timetable, practice left out: what a person wants to
    // know is when qualifying, the sprint and the race are.
    sessions: (e.schedule || [])
      .filter((s) => s.type !== "practice" && s.startTime)
      .map((s) => ({ kind: s.type, name: s.name, start: new Date(s.startTime).toISOString() }))
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start)),
    status: { state, detail: state === STATE.final ? "Race" : state === STATE.other ? "Cancelled" : undefined },
    results: classification,
    _sessionId: race.id,
    _eventId: e.id,
    _completed: race.status === "completed",
  };
}

function titleCase(s) {
  if (!s || s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\bOf\b/g, "of");
}

/**
 * @param sport   "formula1" | "moto-gp"
 * @param league  { id: "f1" | "motogp", name, short }
 * @param nationalities optional async () => { lastName: nationality } for flags
 */
export function motorsportProvider({ sport, league, key, quota, log = () => {}, nationalities }) {
  const headers = { "x-api-key": key };
  async function get(path) {
    if (!key) throw new Error("Orange Cat Blacktop key missing");
    const { body } = await getJson(`${BASE}/${sport}${path}`, { headers });
    quota.record(undefined);
    return body;
  }
  const teamTable = sport === "formula1" ? { path: "/standings/constructors", id: "constructors" } : { path: "/standings/teams", id: "teams" };
  return {
    sport: league.id,
    /** Drivers + teams championship tables. 2 calls. */
    async standings() {
      const nats = nationalities ? await nationalities().catch(() => ({})) : {};
      const drivers = await get("/standings/drivers");
      const teams = await get(teamTable.path);
      const rows = (x) => (Array.isArray(x) ? x : x.data || []);
      // A constructors table reads better with its drivers under the marque,
      // the way Apple Sports writes "G. Russell, K. Antonelli" under Mercedes.
      // They are already in the drivers table, in championship order.
      const lineups = new Map();
      for (const d of rows(drivers)) {
        const team = d.teams?.[0]?.shortName || d.teams?.[0]?.name;
        if (!team) continue;
        const name = `${(d.firstName || "?")[0]}. ${d.lastName || "?"}`;
        lineups.set(team, [...(lineups.get(team) || []), name]);
      }
      return {
        updatedAt: new Date().toISOString(),
        tables: [
          {
            id: "drivers",
            rows: rows(drivers).map((d) => ({
              pos: d.position,
              name: `${(d.firstName || "?")[0]}. ${d.lastName || "?"}`,
              fullName: [d.firstName, d.lastName].filter(Boolean).join(" ") || undefined,
              sub: d.teams?.[0]?.shortName || d.teams?.[0]?.name,
              value: Math.round(Number(d.points)),
              code: d.code || undefined,
              color: d.teams?.[0]?.color || undefined,
              flag: flag(nats[d.lastName]),
            })),
          },
          {
            id: teamTable.id,
            rows: rows(teams).map((t) => {
              const name = t.shortName || t.name;
              return {
                pos: t.position,
                name,
                sub: lineups.get(name)?.slice(0, 3).join(", "),
                code: shortName(name),
                value: Math.round(Number(t.points)),
                color: t.color || undefined,
                kind: "team",
              };
            }),
          },
        ],
      };
    },
    /**
     * Calendar of the current year with podiums for finished races, and the
     * qualifying and sprint results of the weekend under way.
     * `hasResults(id)` lets the caller skip result calls already cached;
     * `cachedSessions(id)` hands back the session results it holds.
     */
    async season({ hasResults = () => false, cachedSessions = () => undefined, year = new Date().getUTCFullYear() } = {}) {
      const list = await get(`/events?limit=100`);
      const nats = nationalities ? await nationalities().catch(() => ({})) : {};
      const events = (list.data || []).filter((e) => String(e.dateStart).startsWith(String(year)));
      const out = [];
      let resultCalls = 0;
      for (const e of events) {
        const base = normaliseEvent(e, { sport, league, nationalities: nats });
        if (!base) continue;
        if (base._completed && !hasResults(base.id) && quota.spendable() > 0) {
          const rows = await get(`/events/${base._eventId}/sessions/${base._sessionId}/results`);
          resultCalls += 1;
          Object.assign(base, normaliseEvent(e, { sport, league, results: Array.isArray(rows) ? rows : rows.data, nationalities: nats }));
          base.resultsFetchedAt = new Date().toISOString();
        }
        const sessions = await sessionResults(e, {
          cached: cachedSessions(base.id),
          fetch: (id) => get(`/events/${e.id}/sessions/${id}/results`),
          budget: (n) => quota.spendable() >= n,
          nationalities: nats,
        });
        resultCalls += sessions.calls;
        base.sessionResults = sessions.sessionResults;
        delete base._sessionId; delete base._eventId; delete base._completed;
        out.push(base);
      }
      log(`OCB ${sport}: ${out.length} rounds in ${year}, ${resultCalls} result fetches`);
      return out;
    },
  };
}
