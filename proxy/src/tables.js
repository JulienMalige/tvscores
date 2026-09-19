/**
 * League tables: the ones built from results, for the competitions whose
 * provider publishes the games but no table — the NFL and NBA (a record, one
 * table per conference, ranked within each division) and the European cups'
 * league phase (points, one table of 36) — and the columns and zones every
 * table carries.
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

/** Column ids the app knows how to label in its four languages. */
export const POINTS_COLUMNS = ["p", "w", "d", "l", "gd", "pts"];
const RECORD_COLUMNS = ["w", "l", "t", "pct"];

/**
 * @param rows   the season's events as the feed sends them
 * @param shape  { rounds: [first, last], scoring: "points" | "record", groups?: { team: { table, division, order } },
 *                 after?: "MM-DD" — games before that day of the season's first year do not count,
 *                 zones?: see zonesFor }
 * @returns { tables: [{ id, columns, rows, zones?, legend? }] } or null when nothing has been played
 */
export function tableFromResults(rows, { rounds: [first, last], scoring, groups, after, zones }, now = Date.now()) {
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
    byTable.get(id).push({ ...t, division: where?.division, order: where?.order ?? 0 });
  }
  const compare = scoring === "record" ? byRecord : byPoints;
  const row = (t, pos) => ({
    pos,
    name: t.name,
    logo: t.logo,
    section: t.division,
    cells: scoring === "record" ? recordCells(t) : pointsCells(t),
    value: scoring === "record" ? t.w : 3 * t.w + t.d,
  });
  const tables = [...byTable.entries()].map(([id, list]) => {
    // A conference is read division by division, each ranked on its own,
    // in the league's order of them; a table with no divisions is one list.
    const divisions = new Map();
    for (const t of list.sort((x, y) => x.order - y.order)) {
      const key = t.division ?? "";
      if (!divisions.has(key)) divisions.set(key, []);
      divisions.get(key).push(t);
    }
    const out = { id, columns: scoring === "record" ? RECORD_COLUMNS : POINTS_COLUMNS, rows: [...divisions.values()].flatMap((group) => group.sort(compare).map((t, i) => row(t, i + 1))) };
    const grouped = [...divisions.keys()].some((k) => k !== "");
    return zones && !grouped ? { ...out, ...zonesFor(zones, out.rows.length) } : out;
  });
  // Conferences in a fixed order; a single table needs none.
  tables.sort((x, y) => x.id.localeCompare(y.id));
  return { tables };
}

/** P · W · D · L · GD · Pts, as strings the app lays out in columns. */
function pointsCells(t) {
  return [t.p, t.w, t.d, t.l, signed(t.f - t.a), 3 * t.w + t.d].map(String);
}

/**
 * A row of a table the feed publishes itself (`lookuptable.php`), in the
 * same shape as the rows built here. `intRank` is the provider's own
 * ordering, so a league that separates on head-to-head is already sorted.
 */
export function feedTableRow(r) {
  const n = (v) => Number(v || 0);
  const t = { p: n(r.intPlayed), w: n(r.intWin), d: n(r.intDraw), l: n(r.intLoss), f: n(r.intGoalsFor), a: n(r.intGoalsAgainst) };
  return {
    pos: Number(r.intRank),
    name: r.strTeam,
    cells: pointsCells(t),
    value: r.intPoints == null ? null : Number(r.intPoints),
    logo: r.strBadge || undefined,
  };
}

/** W · L · T · PCT: the record, with the percentage as the leagues print it. */
function recordCells(t) {
  const pct = t.p ? (t.w + t.d / 2) / t.p : 0;
  return [t.w, t.l, t.d, pct.toFixed(3).replace(/^0/, "")].map(String);
}

/**
 * Where a table is cut: the places that qualify for something, and the
 * places that go down. Given per competition in config as
 * `[{ from, to, key, line }]`, with `key` a word the app translates
 * ("ucl", "relegation", ...) and `line` "solid" or "dashed"; `to` may be
 * left out for a zone that runs to the bottom. The app draws a line after the
 * last row of every zone that has one, and lists the zones under the table.
 */
export function zonesFor(zones, size) {
  const legend = zones.map((z) => ({ from: z.from, to: z.to ?? size, key: z.key }));
  const lines = zones.filter((z) => z.line && (z.to ?? size) < size).map((z) => ({ after: z.to, line: z.line }));
  // A zone that starts below another's end is drawn as a line above it.
  for (const z of zones) if (z.line && z.to == null && z.from > 1) lines.push({ after: z.from - 1, line: z.line });
  return { legend, lines };
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

function signed(n) {
  return n > 0 ? `+${n}` : String(n);
}
