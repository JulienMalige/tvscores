/**
 * A league table built from results, for the competitions whose provider
 * publishes the games but no table: the NFL and NBA (a record, split by
 * conference) and the European cups' league phase (points, one table of 36).
 *
 * Only finished games inside the rounds asked for count — the NFL's preseason
 * and playoffs sit in rounds of their own — and only teams that played in
 * those rounds appear. The cups' qualifiers share the low round numbers with
 * the league phase (qualifying is rounds 1 to 3, the play-off 0, the first
 * matchday 4), so for those the rule is the calendar: the league phase is
 * what is played from September, `after` in the shape.
 */
import { STATE } from "./model.js";
import { stateOf } from "./providers/sportsdb.js";

/**
 * @param rows   the season's events as the feed sends them
 * @param shape  { rounds: [first, last], scoring: "points" | "record", groups?: { team: { table, division } },
 *                 after?: "MM-DD" — games before that day of the season's first year do not count }
 * @returns { tables: [{ id, rows }] } or null when nothing has been played
 */
export function tableFromResults(rows, { rounds: [first, last], scoring, groups, after }, now = Date.now()) {
  const teams = new Map();
  const team = (name, badge) => {
    if (!teams.has(name)) teams.set(name, { name, logo: undefined, p: 0, w: 0, d: 0, l: 0, f: 0, a: 0 });
    const t = teams.get(name);
    if (!t.logo && badge) t.logo = badge; // whichever of its games carries the crest
    return t;
  };
  for (const r of rows) {
    const round = Number(r.intRound);
    if (!(round >= first && round <= last)) continue;
    if (after && !(r.dateEvent >= `${String(r.strSeason || "").slice(0, 4)}-${after}`)) continue;
    if (stateOf(r, now) !== STATE.final) continue;
    const h = Number(r.intHomeScore);
    const a = Number(r.intAwayScore);
    if (!Number.isFinite(h) || !Number.isFinite(a)) continue;
    const home = team(r.strHomeTeam, r.strHomeTeamBadge);
    const away = team(r.strAwayTeam, r.strAwayTeamBadge);
    for (const [t, gf, ga] of [[home, h, a], [away, a, h]]) {
      t.p += 1;
      t.f += gf;
      t.a += ga;
      if (gf > ga) t.w += 1;
      else if (gf < ga) t.l += 1;
      else t.d += 1;
    }
  }
  if (!teams.size) return null;

  const byTable = new Map();
  for (const t of teams.values()) {
    const where = groups?.[t.name];
    const id = where?.table ?? "table";
    if (!byTable.has(id)) byTable.set(id, []);
    byTable.get(id).push({ ...t, division: where?.division });
  }
  const tables = [...byTable.entries()].map(([id, list]) => ({
    id,
    rows: list.sort(scoring === "record" ? byRecord : byPoints).map((t, i) => ({
      pos: i + 1,
      name: t.name,
      sub: scoring === "record" ? record(t) : `${t.p} · ${t.w}-${t.d}-${t.l} · ${signed(t.f - t.a)}`,
      value: scoring === "record" ? t.w : 3 * t.w + t.d,
      logo: t.logo,
    })),
  }));
  // Conferences in a fixed order; a single table needs none.
  tables.sort((x, y) => x.id.localeCompare(y.id));
  return { tables };
}

/** Points, then goal difference, then goals scored: the cups' own order. */
function byPoints(x, y) {
  return (3 * y.w + y.d) - (3 * x.w + x.d) || (y.f - y.a) - (x.f - x.a) || y.f - x.f || x.name.localeCompare(y.name);
}

/** Win percentage, then points differential: enough for a table on a television. */
function byRecord(x, y) {
  const pct = (t) => (t.p ? (t.w + t.d / 2) / t.p : 0);
  return pct(y) - pct(x) || (y.f - y.a) - (x.f - x.a) || x.name.localeCompare(y.name);
}

/** "3-1" or "3-1-1" with a tie, then the division when we know it. */
function record(t) {
  const wl = t.d ? `${t.w}-${t.l}-${t.d}` : `${t.w}-${t.l}`;
  return t.division ? `${wl} · ${t.division}` : wl;
}

function signed(n) {
  return n > 0 ? `+${n}` : String(n);
}
