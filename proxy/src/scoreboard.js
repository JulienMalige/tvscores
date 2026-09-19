import { STATE } from "./model.js";
import { photoKey } from "./photos.js";

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
 * Every competition we follow, in display order, whether or not it is playing.
 *
 * The day buckets only carry leagues with something in them, so a fortnightly
 * series vanishes from the app between races — which is how the Formula 1
 * page became unreachable for eleven days at a time. This list is what a menu
 * is built from, and `playing` says which of them have anything this week.
 */
function everyLeague(sportOrder, leagues = {}, publicBase = "", standings = {}, days = {}) {
  const playing = new Set(
    Object.values(days).flatMap((groups) => groups.map((g) => `${g.sport}:${g.league.id}`)),
  );
  const order = (s) => (sportOrder.indexOf(s) + 1 || 99);
  return Object.entries(leagues)
    .flatMap(([sport, list]) => list.map((l) => ({ sport, cfg: l })))
    .sort((a, b) => order(a.sport) - order(b.sport) || a.cfg.name.localeCompare(b.cfg.name))
    .map(({ sport, cfg }) => {
      const key = `${sport}:${cfg.id}`;
      return {
        sport,
        id: cfg.id,
        name: cfg.name,
        menu: cfg.menu || cfg.name,
        short: cfg.short,
        logo: cfg.badge ? `${publicBase}/v1/assets/leagues/${cfg.badge}.png` : cfg.logo,
        // The same mark alone, on a transparent square. The sidebar needs one
        // competition, because tvOS lays its icons out itself and a wordmark
        // given its own proportions dwarfs the crest under it.
        icon: cfg.badge ? `${publicBase}/v1/assets/leagues/icon/${cfg.badge}.png` : undefined,
        hasStandings: Boolean(standings[key]),
        playing: playing.has(key),
      };
    });
}

/**
 * Buckets: yesterday, today, upcoming (tomorrow onwards, F1 calendar included),
 * computed in the viewer's time zone so "today" means their evening.
 */
/**
 * Copy of an event carrying the picture URLs the app should use: portraits
 * looked up by name, and every image pointed at our own mirror so the
 * television talks to one host instead of three.
 */
export function withPhotos(e, photoFor, mirror) {
  const img = mirror ? (u) => mirror(u) : (u) => u;
  if (!photoFor && !mirror) return e;
  const out = { ...e };
  const photo = (row) => {
    if (!photoFor) return img(row.photo);
    const k = photoKey(row);
    return img(k ? photoFor(k) : undefined);
  };
  if (e.results) out.results = e.results.map((r) => ({ ...r, photo: photo(r) }));
  for (const side of ["home", "away"]) {
    if (!e[side]) continue;
    const team = { ...e[side], logo: img(e[side].logo) };
    if (e.sport === "tennis") team.photo = photo(e[side]);
    else if (team.photo) team.photo = img(team.photo);
    out[side] = team;
  }
  return out;
}

/**
 * @param badgeFor (name) => URL of that constructor's badge, or undefined.
 * Team rows get a badge instead of a portrait: a constructors table is a list
 * of marques, not of people.
 */
export function withTablePhotos(standings, photoFor, mirror, badgeFor) {
  if (!photoFor && !mirror && !badgeFor) return standings;
  if (!standings) return standings;
  const img = mirror ? (u) => mirror(u) : (u) => u;
  const rowPhoto = (r) => {
    if (!photoFor) return img(r.photo);
    const k = photoKey(r);
    return img(k ? photoFor(k) : undefined);
  };
  // A club's crest in a table is mirrored like the ones in match rows: a
  // television fetching forty of them from the provider's CDN at once lost
  // the first few; from this proxy they are one cached file each.
  const decorate = (r) => (r.kind === "team"
    ? { ...r, logo: badgeFor ? badgeFor(r.name) : undefined }
    : { ...r, photo: rowPhoto(r), logo: r.logo ? img(r.logo) : r.logo });
  return { ...standings, tables: standings.tables.map((t) => ({ ...t, rows: t.rows.map(decorate) })) };
}

export function buildScoreboard(events, { tz = "UTC", now = Date.now(), sportOrder = [], meta = {}, leagues = {}, publicBase = "", standings = {}, photoFor, mirror, activeSports = [], upcomingDays = 7 } = {}) {
  events = events.map((e) => withPhotos(e, photoFor, mirror));
  const today = localDate(new Date(now).toISOString(), tz);
  const yesterday = localDate(new Date(now - 86400e3).toISOString(), tz);
  // Upcoming is a window, not the whole calendar: a fixture list weeks out is
  // not what this screen is for.
  const horizon = localDate(new Date(now + upcomingDays * 86400e3).toISOString(), tz);
  const days = { yesterday: [], today: [], upcoming: [] };
  for (const e of events) {
    const d = localDate(e.start, tz);
    // A game still in play belongs to "today" even if it kicked off before local midnight.
    if (e.status.state === STATE.live || d === today) days.today.push(e);
    else if (d === yesterday) days.yesterday.push(e);
    else if (d > today && d <= horizon) days.upcoming.push(e);
  }
  // Upcoming keeps at most the next 10 rounds per racing series; team sports are unlimited.
  const seen = new Map();
  days.upcoming = days.upcoming
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .filter((e) => {
      if (e.kind !== "race") return true;
      const n = (seen.get(e.sport) || 0) + 1;
      seen.set(e.sport, n);
      return n <= 10;
    });
  // Only sports that actually have a scheduler this run are judged stale.
  const active = activeSports.length ? new Set(activeSports) : new Set(Object.keys(meta));
  const stale = Object.fromEntries(
    Object.entries(meta).filter(([sport]) => active.has(sport)).map(([sport, m]) => [sport, !m.lastOk || now - Date.parse(m.lastOk) > 6 * 3600e3]),
  );
  const grouped = Object.fromEntries(Object.entries(days).map(([k, v]) => [k, groupByLeague(v, sportOrder, leagues, publicBase, standings)]));
  return {
    generatedAt: new Date(now).toISOString(),
    tz,
    stale,
    live: events.filter((e) => e.status.state === STATE.live).length,
    leagues: everyLeague(sportOrder, leagues, publicBase, standings, grouped),
    days: grouped,
  };
}
