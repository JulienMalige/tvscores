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
  // The whole classification, not just the podium: the row shows the top three
  // and the race page shows the rest. Drivers who did not finish come last,
  // the one who covered most laps first, and carry no position number.
  const quickest = Array.isArray(results) ? fastestLapId(results) : undefined;
  const row = (r) => {
    const nat = nationalities[r.driver?.lastName];
    const finished = /^\d+$/.test(String(r.position));
    return {
      pos: finished ? Number(r.position) : undefined,
      driver: `${(r.driver?.firstName || "?")[0]}. ${r.driver?.lastName || "?"}`,
      fullName: [r.driver?.firstName, r.driver?.lastName].filter(Boolean).join(" ") || undefined,
      code: r.driver?.code || undefined,
      nationality: nat,
      flag: flag(nat),
      team: r.team?.shortName || r.team?.name,
      teamColor: r.team?.color || undefined,
      // A retirement wants its outcome, not the gap it had when it stopped.
      gap: finished ? (Number(r.position) === 1 ? r.lapTime : gapText(r)) : (outcomeText(r) || "DNF"),
      grid: num(r.gridPosition),
      points: num(r.points),
      laps: num(r.laps),
      fastestLap: quickest && (r.id ?? r.driver?.id) === quickest ? true : undefined,
    };
  };
  const classification = Array.isArray(results) && results.length
    ? [
        ...results.filter((r) => /^\d+$/.test(String(r.position))).sort((a, b) => Number(a.position) - Number(b.position)),
        ...results.filter((r) => !/^\d+$/.test(String(r.position))).sort((a, b) => (Number(b.laps) || 0) - (Number(a.laps) || 0)),
      ].map(row)
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
    results: classification,
    _sessionId: race.id,
    _eventId: e.id,
    _completed: race.status === "completed",
  };
}

/** "1:35.587" or "58.214" in seconds; undefined when there is no lap time. */
export function lapSeconds(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return undefined;
  const m = t.match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  if (!m) return undefined;
  return Number(m[1] || 0) * 60 + Number(m[2]);
}

/**
 * Who set the fastest lap. The feed carries a `fastestLap` object but leaves
 * it empty, so trust its rank when it has one and otherwise take the quickest
 * best lap in the field.
 */
function fastestLapId(rows) {
  const ranked = rows.find((r) => Number(r.fastestLap?.rank) === 1);
  if (ranked) return ranked.id ?? ranked.driver?.id;
  let best;
  for (const r of rows) {
    const s = lapSeconds(r.bestLapTime);
    if (s === undefined) continue;
    if (!best || s < best.s) best = { s, id: r.id ?? r.driver?.id };
  }
  return best?.id;
}

/** A number the provider actually sent, zero included. */
const num = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) ? undefined : Number(v));

/** Motorsport's own shorthand for a car that did not make the flag. */
// MotoGP speaks in its own codes (OUTSTND, NOTFINISHFIRST); anything not
// classified is a retirement unless the feed says something more specific.
const OUTCOME = {
  retired: "DNF", dnf: "DNF", outstnd: "DNF", notfinishfirst: "DNF",
  dns: "DNS", "did not start": "DNS", notstarted: "DNS",
  dsq: "DSQ", disqualified: "DSQ", excluded: "DSQ",
};

/** DNF, DNS, DSQ: what a car that did not make the flag gets instead of a gap. */
function outcomeText(r) {
  for (const field of [r.status, r.displayTime, r.gap]) {
    const hit = OUTCOME[String(field || "").toLowerCase().trim()];
    if (hit) return hit;
  }
  return undefined;
}

/** F1 gives "+4.351s" in `gap`/`displayTime`; MotoGP gives a bare "0.657" in `displayTime`. */
function gapText(r) {
  const raw = r.gap || r.displayTime;
  if (raw == null || raw === "") return outcomeText(r);
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
