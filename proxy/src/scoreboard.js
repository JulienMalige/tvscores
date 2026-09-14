import { STATE } from "./model.js";

/** Local calendar date (YYYY-MM-DD) of an instant in a time zone. */
export function localDate(iso, tz) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function groupByLeague(events, sportOrder, leagues = {}, publicBase = "", standings = {}) {
  const groups = new Map();
  for (const e of events) {
    const key = `${e.sport}:${e.league.id}`;
    if (!groups.has(key)) {
      // League logo comes from config at serve time so cached events need no refresh.
      const cfg = (leagues[e.sport] || []).find((l) => String(l.id) === String(e.league.id));
      const logo = cfg?.badge ? `${publicBase}/v1/assets/leagues/${cfg.badge}.png` : cfg?.logo;
      groups.set(key, { sport: e.sport, league: { ...e.league, logo, hasStandings: Boolean(standings[key]) }, events: [] });
    }
    groups.get(key).events.push(e);
  }
  const order = (s) => (sportOrder.indexOf(s) + 1 || 99);
  return [...groups.values()]
    .sort((a, b) => order(a.sport) - order(b.sport) || a.league.name.localeCompare(b.league.name))
    .map((g) => ({ ...g, events: g.events.sort((a, b) => Date.parse(a.start) - Date.parse(b.start)) }));
}

/**
 * Buckets: yesterday, today, upcoming (tomorrow onwards, F1 calendar included),
 * computed in the viewer's time zone so "today" means their evening.
 */
/** Copy of an event with cached photo URLs on podium rows and tennis players. */
export function withPhotos(e, photoFor) {
  if (!photoFor) return e;
  const out = { ...e };
  if (e.results) out.results = e.results.map((r) => ({ ...r, photo: r.fullName ? photoFor(r.fullName) : undefined }));
  if (e.sport === "tennis") for (const side of ["home", "away"]) if (e[side]) out[side] = { ...e[side], photo: photoFor(e[side].name) };
  return out;
}

export function withTablePhotos(standings, photoFor) {
  if (!photoFor || !standings) return standings;
  return { ...standings, tables: standings.tables.map((t) => ({ ...t, rows: t.rows.map((r) => ({ ...r, photo: photoFor(r.fullName || r.name) })) })) };
}

export function buildScoreboard(events, { tz = "UTC", now = Date.now(), sportOrder = [], meta = {}, leagues = {}, publicBase = "", standings = {}, photoFor } = {}) {
  events = events.map((e) => withPhotos(e, photoFor));
  const today = localDate(new Date(now).toISOString(), tz);
  const yesterday = localDate(new Date(now - 86400e3).toISOString(), tz);
  const days = { yesterday: [], today: [], upcoming: [] };
  for (const e of events) {
    const d = localDate(e.start, tz);
    // A game still in play belongs to "today" even if it kicked off before local midnight.
    if (e.status.state === STATE.live || d === today) days.today.push(e);
    else if (d === yesterday) days.yesterday.push(e);
    else if (d > today) days.upcoming.push(e);
  }
  // Upcoming keeps at most the next 10 F1 rounds and everything else; sorted later.
  days.upcoming = days.upcoming.filter((e) => e.kind !== "race" || days.upcoming.filter((x) => x.kind === "race" && x.start <= e.start).length <= 10);
  const stale = Object.fromEntries(
    Object.entries(meta).map(([sport, m]) => [sport, !m.lastOk || now - Date.parse(m.lastOk) > 6 * 3600e3]),
  );
  return {
    generatedAt: new Date(now).toISOString(),
    tz,
    stale,
    live: events.filter((e) => e.status.state === STATE.live).length,
    days: Object.fromEntries(Object.entries(days).map(([k, v]) => [k, groupByLeague(v, sportOrder, leagues, publicBase, standings)])),
  };
}
