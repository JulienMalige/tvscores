import { photoKey } from "./photos.js";
import { withTablePhotos } from "./scoreboard.js";

/**
 * The teams and athletes a viewer can follow (My Teams, docs/roadmap.md §4).
 *
 * A favourite is kept on the device as a key, `sport:slug-of-the-name`:
 * "football:paris-saint-germain", "f1:k-antonelli", "tennis:jannik-sinner".
 * The proxy writes it on every side of a game, every row of a race and every
 * row of a table, so the app never derives one itself, and a club named two
 * ways by two sources can later be given one key here. The games and the
 * tables already agree on names (the records under a game to come are
 * matched on them), so the name is what the key is made of.
 */
export function teamKey(sport, name) {
  const slug = String(name ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug ? `${sport}:${slug}` : undefined;
}

/** A game with a key on each side, a race with one on each classified driver. */
export function withKeys(e) {
  const out = { ...e };
  for (const side of ["home", "away"]) if (e[side]) out[side] = { ...e[side], key: teamKey(e.sport, e[side].name) };
  if (e.results) out.results = e.results.map((r) => ({ ...r, key: teamKey(e.sport, r.driver) }));
  return out;
}

/** How long a team seen in a game stays in its competition's list: a season and a bit. */
export const ROSTER_DAYS = 400;

/**
 * Remembers who played in each competition, for the competitions with no
 * table to list them (cups, friendlies, the Nations League) and the players
 * a top-25 ranking leaves out: `roster["football:4490"]["football:france"]`.
 * Races are left out, their drivers and riders come from the standings.
 */
export function noteRoster(roster, events, now = Date.now()) {
  let changed = false;
  for (const e of events) {
    if (e.kind === "race" || !e.league?.id) continue;
    const list = (roster[`${e.sport}:${e.league.id}`] ??= {});
    for (const side of [e.home, e.away]) {
      const key = side && teamKey(e.sport, side.name);
      if (!key) continue;
      const day = new Date(now).toISOString().slice(0, 10);
      const old = list[key];
      const entry = { name: side.name, logo: side.logo || old?.logo, flag: side.flag || old?.flag, seen: day };
      if (old?.seen === day && old.logo === entry.logo) continue;
      list[key] = entry;
      changed = true;
    }
  }
  return changed;
}

/** The roster without anyone unseen for ROSTER_DAYS. */
export function pruneRoster(roster, now = Date.now()) {
  const cutoff = new Date(now - ROSTER_DAYS * 86400e3).toISOString().slice(0, 10);
  let changed = false;
  for (const list of Object.values(roster)) {
    for (const [key, entry] of Object.entries(list)) {
      if (entry.seen < cutoff) {
        delete list[key];
        changed = true;
      }
    }
  }
  return changed;
}

/**
 * `/v1/teams`: every competition's followable sides, by "sport:league", in
 * name order: `{ key, name, logo?, photo?, flag? }`. A table's rows come
 * first (they are this season's), then whoever the roster saw play; a
 * constructors table is left out, since a driver is followed, not a marque.
 * `tableFor(id)` is the table as the app is served it, crests mirrored.
 */
export function buildTeams({ sports, leagues = {}, tableFor = () => undefined, roster = {}, photoFor, mirror }) {
  const img = (u) => (u && mirror ? mirror(u) : u);
  const out = {};
  for (const sport of sports) {
    for (const league of leagues[sport] || []) {
      const id = `${sport}:${league.id}`;
      const found = new Map();
      // A driver's key is his name as the races write it, "K. Antonelli";
      // the list shows his full name.
      const add = (name, extra, shown = name) => {
        const key = teamKey(sport, name);
        if (key && !found.has(key)) found.set(key, Object.fromEntries(Object.entries({ key, name: shown, ...extra }).filter(([, v]) => v)));
      };
      const table = tableFor(id);
      for (const t of table?.tables || []) {
        for (const r of t.rows || []) if (r.kind !== "team") add(r.name, { logo: r.logo, photo: r.photo, flag: r.flag }, r.fullName || r.name);
      }
      for (const entry of Object.values(roster[id] || {})) {
        const k = photoKey(entry);
        add(entry.name, { logo: img(entry.logo), flag: entry.flag, photo: sport === "tennis" && photoFor && k ? img(photoFor(k)) : undefined });
      }
      if (found.size) out[id] = [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
    }
  }
  return { teams: out };
}

/** The route's answer from the store, each table as the app is served it. */
export function teamsBody(store, { sports, leagues, photoFor, mirror, badgeFor }) {
  const tableFor = (id) => store.standings[id] && withTablePhotos(store.standings[id], photoFor, mirror, badgeFor(id.split(":")[0]));
  return buildTeams({ sports, leagues, tableFor, roster: store.roster, photoFor, mirror });
}
