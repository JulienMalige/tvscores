import { getJson } from "../http.js";
import { STATE, flag, shortName } from "../model.js";

const BASE = "https://api.ocblacktop.com/v1";
const RACE_HOURS = 3;

/** Orange Cat Blacktop: one calendar-and-results API for every motorsport. */
export function normaliseEvent(e, { sport, league, results, nationalities = {}, now = Date.now() }) {
  const race = (e.schedule || []).find((s) => s.type === "race");
  if (!race) return null; // testing weeks have no race session
  const start = new Date(race.startTime).toISOString();
  const startMs = Date.parse(start);
  let state = STATE.scheduled;
  if (race.status === "cancelled" || e.status === "cancelled") state = STATE.other;
  else if (race.status === "completed") state = STATE.final;
  else if (now >= startMs && now < startMs + RACE_HOURS * 3600e3) state = STATE.live;
  const podium = Array.isArray(results) && results.length
    ? results
        .filter((r) => /^\d+$/.test(String(r.position)))
        .sort((a, b) => Number(a.position) - Number(b.position))
        .slice(0, 3)
        .map((r) => {
          const nat = nationalities[r.driver?.lastName];
          return {
            pos: Number(r.position),
            driver: `${(r.driver?.firstName || "?")[0]}. ${r.driver?.lastName || "?"}`,
            fullName: [r.driver?.firstName, r.driver?.lastName].filter(Boolean).join(" ") || undefined,
            code: r.driver?.code || undefined,
            nationality: nat,
            flag: flag(nat),
            team: r.team?.shortName || r.team?.name,
            teamColor: r.team?.color || undefined,
            gap: Number(r.position) === 1 ? r.lapTime : gapText(r),
          };
        })
    : undefined;
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
    status: { state, detail: state === STATE.final ? "Race" : state === STATE.other ? "Cancelled" : undefined },
    results: podium,
    _sessionId: race.id,
    _eventId: e.id,
    _completed: race.status === "completed",
  };
}

/** F1 gives "+4.351s" in `gap`/`displayTime`; MotoGP gives a bare "0.657" in `displayTime`. */
function gapText(r) {
  const raw = r.gap || r.displayTime;
  if (raw == null || raw === "") return r.status;
  const t = String(raw).trim();
  if (/^\+?\d+(\.\d+)?s?$/.test(t)) return `+${t.replace(/^\+/, "").replace(/s$/, "")}s`;
  return t; // "+1 lap", "LAP 57", etc.
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
            rows: rows(teams).map((t) => ({ pos: t.position, name: t.shortName || t.name, code: shortName(t.shortName || t.name), value: Math.round(Number(t.points)), color: t.color || undefined, kind: "team" })),
          },
        ],
      };
    },
    /**
     * Calendar of the current year with podiums for finished races.
     * `hasResults(id)` lets the caller skip result calls already cached.
     */
    async season({ hasResults = () => false, year = new Date().getUTCFullYear() } = {}) {
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
        delete base._sessionId; delete base._eventId; delete base._completed;
        out.push(base);
      }
      log(`OCB ${sport}: ${out.length} rounds in ${year}, ${resultCalls} result fetches`);
      return out;
    },
  };
}
