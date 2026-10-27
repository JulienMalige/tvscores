import { getJson } from "../http.js";
import { surname } from "../photos.js";

const BASE = "https://www.thesportsdb.com/api/v1/json";
const DAY = 24 * 3600e3;

/**
 * The flags on a series' results: { surname: nationality } for the drivers
 * in its teams on TheSportsDB, one list a day, a dozen calls for Formula 1.
 * It comes on the key we pay for, whose terms allow an app; Jolpica's driver
 * list, used before, is non-commercial (docs/motorsport-sources.md). A
 * refresh that fails keeps the last list and waits before the next try,
 * five minutes doubling to an hour.
 */
export function driverNationalities({ key, league = "Formula 1", get = getJson, now = Date.now }) {
  let known; // { at, map } once a list has come in
  let failures = 0;
  let retryAt = 0;
  return async () => {
    if (known && now() - known.at < DAY) return known.map;
    if (now() < retryAt) {
      if (known) return known.map;
      throw new Error("no driver list yet, and the last try failed");
    }
    try {
      const { body } = await get(`${BASE}/${key}/search_all_teams.php?l=${encodeURIComponent(league)}`);
      const rosters = await Promise.all((body.teams || []).map((t) => get(`${BASE}/${key}/lookup_all_players.php?id=${t.idTeam}`)));
      const map = {};
      // Drivers only, reserves included: a team's staff can share a surname.
      for (const { body: roster } of rosters) {
        for (const p of roster.player || []) if (p.strNationality && /driver/i.test(p.strPosition || "")) map[surname(p.strPlayer)] = p.strNationality;
      }
      known = { at: now(), map };
      failures = 0;
    } catch (err) {
      retryAt = now() + Math.min(5 * 60e3 * 2 ** failures++, 3600e3);
      if (!known) throw err;
    }
    return known.map;
  };
}
