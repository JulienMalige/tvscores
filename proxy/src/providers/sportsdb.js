import { getJson } from "../http.js";
import { tableFromResults, feedTableRow, zonesFor, POINTS_COLUMNS } from "../tables.js";
import { DIVISIONS } from "../divisions.js";
import { SPORTS, startOf, normaliseEvent, datesAround, isYouth } from "./sportsdb-events.js";

const V1 = "https://www.thesportsdb.com/api/v1/json";
const V2 = "https://www.thesportsdb.com/api/v2/json";

/**
 * A team sport from TheSportsDB: one call per day of the window, filtered to
 * the competitions we show. The paid key returns up to 1,500 events for a
 * date, which is why a seven-day Upcoming costs one call per day rather than
 * a season fixture list per league — and why a competition costs nothing.
 */
export function sportsDbSport({ sport, key, leagues, window: win, quota, seasons = {}, next = {}, log = () => {} }) {
  const { feed, live: livePath } = SPORTS[sport];
  /** A call counts against the day whether or not it answers: a refusal was still spent. */
  const call = async (url, opts) => {
    try {
      return await getJson(url, opts);
    } finally {
      quota.record(undefined);
    }
  };
  const byId = new Map(leagues.map((l) => [String(l.id), l]));
  /** A fixture of ours: a competition we follow, and a game its filters keep. */
  const wanted = (r) => {
    const league = byId.get(String(r.idLeague));
    if (!league) return false;
    if (league.seniorOnly && isYouth(r)) return false;
    return !league.teams || league.teams.includes(r.strHomeTeam) || league.teams.includes(r.strAwayTeam);
  };
  const mine = (rows) => {
    const keep = rows.filter(wanted);
    // Every fixture names its own season, so the table lookup never needs a
    // call of its own — nor a hardcoded year that goes stale each August.
    for (const r of keep) if (r.strSeason) seasons[String(r.idLeague)] = r.strSeason;
    // One row the feed got wrong (a placeholder with no team yet) is that row's loss.
    return keep.map((r) => {
      try {
        return normaliseEvent(r, byId.get(String(r.idLeague)), sport);
      } catch (err) {
        log(`sportsdb ${sport}: skipped a row (${err.message})`);
        return undefined;
      }
    }).filter(Boolean);
  };

  /**
   * One date. The scheduler asks for this when a match it was watching leaves
   * the live feed: the livescore endpoint only lists games in progress, so a
   * match that ends simply vanishes from it, and its final score has to be
   * read back from the day's fixtures.
   */
  async function byDate(date) {
    if (!key) throw new Error("TheSportsDB key missing");
    const { body } = await call(`${V1}/${key}/eventsday.php?d=${date}&s=${encodeURIComponent(feed)}`);
    return mine(body?.events || []);
  }

  /**
   * The window, one date at a time. A date that fails costs that date and not
   * the others: the answer is what came, marked `partial` so the scheduler
   * asks again soon; only a window in which nothing came is an error.
   */
  async function daily() {
    const out = [];
    const dates = datesAround(win);
    let failed = 0, lastError;
    for (const date of dates) {
      try {
        out.push(...(await byDate(date)));
      } catch (err) {
        failed += 1;
        lastError = err;
        log(`sportsdb ${sport} ${date}: ${err.message}`);
      }
    }
    if (failed === dates.length) throw lastError;
    log(`GET sportsdb ${sport} ${dates.length - failed} of ${dates.length} days -> ${out.length} matches`);
    await nextFixtures(out);
    out.partial = failed > 0;
    return out;
  }

  /**
   * For a competition with nothing in the window — between seasons, or in
   * a break — when it is next on, so the app can say "back in October"
   * rather than "no games". One call per such competition per daily pass;
   * `next` is the sport's meta and persists. A competition with fixtures
   * again keeps it until that game has begun: the season's first week is
   * when "Season Starts Saturday" is worth saying, and its games are in the
   * window by then.
   */
  async function nextFixtures(events) {
    const busy = new Set(events.map((e) => String(e.league.id)));
    for (const league of leagues) {
      const id = String(league.id);
      if (busy.has(id)) {
        if (!(next[id] && Date.parse(next[id].start) > Date.now())) delete next[id];
        continue;
      }
      let body;
      try {
        ({ body } = await call(`${V1}/${key}/eventsnextleague.php?id=${id}`));
      } catch (err) {
        log(`sportsdb ${sport} next ${id}: ${err.message}`); // what we knew of it stays
        continue;
      }
      const soonest = (body?.events || []).filter((r) => wanted({ ...r, idLeague: id })).map((r) => ({ start: startOf(r), season: r.strSeason })).filter((r) => r.start).sort((a, b) => a.start.localeCompare(b.start))[0];
      // A new season when its label is not the one the league's own games
      // last carried: the NBA's first game of 2026-2027 after 2025-2026,
      // but not the Champions League's next round within 2026-2027 — the
      // app says "Season Starts" only for the first (Julien, 2026-09-28).
      // A season we never saw is not called new: a league just added, or a
      // wiped store, would otherwise announce one mid-season. Nor is one
      // with no seasons of its own — friendlies are labelled by the year.
      const newSeason = !league.seasonless && Boolean(soonest?.season && seasons[id]) && soonest.season !== seasons[id];
      if (soonest) next[id] = { ...soonest, newSeason };
      else delete next[id];
    }
  }

  /** V2 carries the minute and the running score; V1 only catches up at the whistle. */
  async function live() {
    if (!key) throw new Error("TheSportsDB key missing");
    const { body } = await call(`${V2}/livescore/${livePath}`, { headers: { "X-API-KEY": key } });
    const rows = mine(body?.livescore || []);
    log(`GET sportsdb livescore ${livePath} -> ${rows.length} of ours in play`);
    return rows;
  }

  /**
   * The season a table is asked for. Fixtures name their own season, so this
   * is usually already known and free; a proxy that has not fetched fixtures
   * yet asks the league itself, once, and keeps the answer.
   */
  async function currentSeason(id) {
    const { body } = await call(`${V1}/${key}/lookupleague.php?id=${id}`);
    const season = (body?.leagues || [])[0]?.strCurrentSeason;
    if (season) seasons[String(id)] = season;
    return season;
  }

  /**
   * One league table per competition that has one. A knockout cup has no
   * table and a season that has not started has no rows: both come back
   * empty, and an empty table is dropped rather than shown as a blank page.
   *
   * A competition configured with `table` gets none from the feed at all —
   * the NFL, the NBA, the European cups — and has its table built here from
   * the season's results, one call for the whole season.
   */
  async function standings(only) {
    if (!key) throw new Error("TheSportsDB key missing");
    const out = {};
    let failed = 0, lastError;
    for (const league of leagues) {
      if (only && !only.has(String(league.id))) continue;
      try {
        const season = seasons[String(league.id)] || (await currentSeason(league.id));
        if (!season) continue;
        if (league.table) {
          const { body } = await call(`${V1}/${key}/eventsseason.php?id=${league.id}&s=${encodeURIComponent(season)}`);
          const built = tableFromResults(body?.events || [], { ...league.table, groups: DIVISIONS[league.table.groups], zones: league.zones });
          if (built) out[league.id] = { updatedAt: new Date().toISOString(), ...built };
          continue;
        }
        const { body } = await call(`${V1}/${key}/lookuptable.php?l=${league.id}&s=${encodeURIComponent(season)}`);
        const rows = (body?.table || []).map(feedTableRow);
        if (rows.length) {
          const table = { id: "table", columns: POINTS_COLUMNS, rows, ...(league.zones ? zonesFor(league.zones, rows.length) : {}) };
          out[league.id] = { updatedAt: new Date().toISOString(), tables: [table] };
        }
      } catch (err) {
        // One league's table failing leaves the others' tables, and its own as it was.
        failed += 1;
        lastError = err;
        log(`sportsdb ${sport} table ${league.id}: ${err.message}`);
      }
    }
    if (failed && !Object.keys(out).length) throw lastError;
    log(`GET sportsdb ${sport} tables -> ${Object.keys(out).length} of ${leagues.length}`);
    return out;
  }

  return { sport, daily, live, byDate, standings, standingsFollowResults: true, dailyCost: win.back + win.ahead + 1 };
}
