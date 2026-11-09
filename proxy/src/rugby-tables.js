/**
 * Rugby tables, from Wikipedia (Julien, 2026-11-09: "Rugby from wiki, even
 * a day late"; the terms are in docs/data-providers.md). Neither of our
 * feeds has this season's, and one built from results would miss the bonus
 * points, which need the tries. Wikipedia's are kept by volunteers, so each
 * competition's table says how many games already played it is still
 * missing, and names its source under it.
 */
import { STATE } from "./model.js";
import { zonesFor, signed } from "./tables.js";
import { rugbyName, stateOf } from "./providers/sportsdb-events.js";
import { plain, sameClub } from "./providers/live-backup.js";
import { articleUrl } from "./providers/wikipedia.js";
import { linkOf, tablesIn } from "./wiki-tables.js";

/** A table that holds every game played, in a competition with nothing this week, is looked at once a day. */
const RESTING_LOOK = 24 * 3600e3;
/** A season's games are asked for again after this, and at once after a final whistle in it. */
const SEASON_FOR = 6 * 3600e3;

/** P · W · D · L · PD · BP · Pts: a rugby table as the leagues print theirs, the bonus points in one column. */
const RUGBY_COLUMNS = ["p", "w", "d", "l", "pd", "bp", "pts"];

/** The Top 14's places: two to the semi-finals, four to the play-offs, the 13th to the access match, the 14th down. */
const TOP_14 = [
  { from: 1, to: 2, key: "semifinals", line: "solid" },
  { from: 3, to: 6, key: "playoffs", line: "solid" },
  { from: 13, to: 13, key: "relegation-playoff" },
  { from: 14, key: "relegation", line: "dashed" },
];

/**
 * Where each competition's table is on Wikipedia: the article credited
 * under it, and in `tables` the page of each table when it is not the
 * article itself (the k-th table asked of a page is its k-th one).
 * `{season}` is the season as TheSportsDB names it ("2026-2027", "2027"),
 * `{years}` as English Wikipedia writes it ("2026–27"), so the pages follow
 * the seasons on their own. `rounds` are the feed's rounds the tables count,
 * in which the games missing from them are counted: its knockouts are 16
 * and from 100. Zones as football's, this season's formats (2026-11-09).
 */
const SOURCES = {
  4430: { lang: "fr", article: "Championnat de France de rugby à XV {season}", rounds: [1, 26], zones: TOP_14 },
  4550: {
    lang: "en", article: "{years} European Rugby Champions Cup", rounds: [1, 4], zones: [{ from: 1, to: 3, key: "r16", line: "solid" }],
    tables: Object.fromEntries([1, 2, 3, 4].map((n) => [`pool-${n}`, `Template:{years} European Rugby Champions Cup Pool ${n} table`])),
  },
  4414: { lang: "en", article: "{years} Premiership Rugby", rounds: [1, 18], zones: [{ from: 1, to: 4, key: "semifinals", line: "solid" }] },
  5852: { lang: "en", article: "{season} Nations Championship", rounds: [1, 6], tables: { north: "{season} Nations Championship", south: "{season} Nations Championship" } },
  4714: { lang: "en", article: "{season} Six Nations Championship", rounds: [1, 5] },
  4574: {
    lang: "en", article: "{season} Rugby World Cup", rounds: [1, 15], zones: [{ from: 1, to: 2, key: "r16", line: "solid" }],
    tables: Object.fromEntries([..."ABCDEF"].map((p) => [`pool-${p.toLowerCase()}`, `{season} Men's Rugby World Cup Pool ${p}`])),
  },
};

/** A season as English Wikipedia names it: "2026-2027" is "2026–27", and a one-year season stays as it is. */
export function years(season) {
  const m = /^(\d{4})-\d{2}(\d{2})$/.exec(season);
  return m ? `${m[1]}–${m[2]}` : season;
}

const filled = (title, season) => title.replaceAll("{season}", season).replaceAll("{years}", years(season));

/** The sides of a season's games under the names our fixtures give them, with the feed's own name and the crest. */
export function sidesOf(games) {
  const sides = new Map();
  for (const g of games) {
    for (const [feed, crest] of [[g.strHomeTeam, g.strHomeTeamBadge], [g.strAwayTeam, g.strAwayTeamBadge]]) {
      if (!feed) continue;
      const name = rugbyName(feed);
      if (!sides.has(name)) sides.set(name, { name, feed });
      sides.get(name).logo ??= crest || undefined;
    }
  }
  return [...sides.values()];
}

/**
 * Which of our sides each row is: the same name first (Wikipedia's words or
 * its link, against our name or the feed's), then one holding the other
 * ("Glasgow Warriors" is our "Glasgow", "ASM Clermont Auvergne" our
 * "Clermont Auvergne"). A side is used once, and a row two sides fit as
 * well keeps the name Wikipedia gives it.
 */
export function matchSides(rows, sides) {
  const found = new Map();
  const taken = new Set();
  const words = (row) => [row.label, row.target?.replace(/\s*\(.*\)$/, "")].filter(Boolean);
  const same = (row, side) => words(row).some((w) => plain(w) === plain(side.name) || plain(w) === plain(side.feed));
  const close = (row, side) => words(row).some((w) => sameClub(w, side.name) || sameClub(w, side.feed));
  for (const fits of [same, close]) {
    for (const row of rows) {
      if (found.has(row)) continue;
      const hits = sides.filter((s) => !taken.has(s) && fits(row, s));
      if (hits.length === 1) {
        found.set(row, hits[0]);
        taken.add(hits[0]);
      }
    }
  }
  return found;
}

/** The season's games the feed has seen end, or API-Sports has (`results`, by our event id), in `rounds`. */
export function finishedIn(games, [first, last], results = {}, now = Date.now()) {
  return games.filter((g) => {
    const round = Number(g.intRound);
    if (!(round >= first && round <= last)) return false;
    return stateOf(g, now) === STATE.final || results[`rugby:tsdb:${g.idEvent}`]?.state === STATE.final;
  }).length;
}

/**
 * One competition's tables as ours: each row under our name for the side
 * and with its crest, cut into the competition's zones, and the credit the
 * licence asks for, with how many of the `finished` games the tables do not
 * hold yet (each game is in two rows).
 */
export function standingsFrom({ tables, sides, finished, source, title, lang }) {
  const held = tables.reduce((n, t) => n + t.rows.reduce((m, r) => m + r.w + r.d + r.l, 0), 0) / 2;
  return {
    tables: tables.map(({ id, rows }) => {
      const found = matchSides(rows, sides);
      const list = rows.map((r, i) => ({
        pos: i + 1,
        name: found.get(r)?.name ?? (r.label || r.target || ""),
        logo: found.get(r)?.logo,
        cells: [r.w + r.d + r.l, r.w, r.d, r.l, signed(r.pf - r.pa), r.bonus, r.pts].map(String),
        value: r.pts,
      }));
      return { id, columns: RUGBY_COLUMNS, rows: list, ...(source.zones ? zonesFor(source.zones, list.length) : {}) };
    }),
    source: { site: "wikipedia", title, url: articleUrl(lang, title), license: "CC BY-SA 4.0", missing: Math.max(0, finished - Math.floor(held)) },
  };
}

/**
 * The tables of the competitions in `leagues` that have a source, as a
 * provider's `standings(only)` returns them: `only` is the competitions a
 * final whistle has just moved. One request per Wikipedia for every page,
 * another for the names not seen before (a name expanded once is known for
 * good), and each competition's season of games from `seasonGames`, for the
 * crests and the games missing. A competition where nobody has played yet
 * has no table. One `resting` (no game within a day) is looked at daily once
 * its table holds every game played; until then, every hour, which is when
 * the volunteers catch up.
 */
export function rugbyTables({ wiki, leagues, seasonOf, seasonGames, resting = () => false, results = {}, log = () => {}, now = () => Date.now() }) {
  const known = new Map(); // "lang|source of a name" -> { label, target }
  const looked = new Map(); // league id -> when its pages last came back
  const complete = new Map(); // league id -> its table held every game played, at that look
  const seasons = new Map(); // league id -> { season, at, games }

  async function gamesOf(id, season, fresh) {
    const kept = seasons.get(id);
    if (!fresh && kept?.season === season && now() - kept.at < SEASON_FOR) return kept.games;
    const games = await seasonGames(id, season);
    seasons.set(id, { season, at: now(), games });
    return games;
  }

  async function named(lang, title, rows) {
    const key = (r) => `${lang}|${r.name}`;
    const todo = [...new Set(rows.filter((r) => r.name.includes("{{") && !known.has(key(r))).map((r) => r.name))];
    if (todo.length) (await wiki.expand(lang, title, todo)).forEach((x, i) => known.set(`${lang}|${todo[i]}`, linkOf(x)));
    return rows.map((r) => ({ ...r, ...(known.get(key(r)) ?? linkOf(r.name)) }));
  }

  async function one({ league, source, season, title, tables }, got, fresh) {
    const asked = new Map();
    const found = [];
    for (const { id, page } of tables) {
      const k = asked.get(page) ?? 0;
      asked.set(page, k + 1);
      const table = got.has(page) ? tablesIn(got.get(page).content)[k] : undefined;
      if (table) found.push({ id, rows: table.rows });
    }
    const games = await gamesOf(league.id, season, fresh);
    const finished = finishedIn(games, source.rounds, results, now());
    if (!found.some((t) => t.rows.some((r) => r.w + r.d + r.l > 0))) {
      complete.set(league.id, finished === 0);
      return undefined;
    }
    const credited = got.get(title)?.title ?? title;
    for (const t of found) t.rows = await named(source.lang, credited, t.rows);
    const built = standingsFrom({ tables: found, sides: sidesOf(games), finished, source, title: credited, lang: source.lang });
    complete.set(league.id, built.source.missing === 0);
    return built;
  }

  return async function standings(only) {
    const plans = [];
    for (const league of leagues) {
      const source = SOURCES[league.id];
      if (!source || (only && !only.has(String(league.id)))) continue;
      if (!only && resting(league.id) && complete.get(league.id) && now() - (looked.get(league.id) ?? 0) < RESTING_LOOK) continue;
      const season = seasonOf(league.id);
      if (!season) continue;
      const tables = Object.entries(source.tables ?? { table: source.article }).map(([id, page]) => ({ id, page: filled(page, season) }));
      plans.push({ league, source, season, title: filled(source.article, season), tables });
    }
    const out = {};
    for (const lang of new Set(plans.map((p) => p.source.lang))) {
      const mine = plans.filter((p) => p.source.lang === lang);
      const got = await wiki.pages(lang, [...new Set(mine.flatMap((p) => p.tables.map((t) => t.page)))]);
      for (const plan of mine) {
        looked.set(plan.league.id, now());
        try {
          const built = await one(plan, got, Boolean(only));
          if (built) out[plan.league.id] = { updatedAt: new Date(now()).toISOString(), ...built };
        } catch (err) {
          log(`wikipedia rugby ${plan.league.id}: ${err.message}`); // its last table stays
        }
      }
    }
    log(`GET wikipedia rugby tables -> ${Object.keys(out).length} of ${plans.length}`);
    return out;
  };
}
