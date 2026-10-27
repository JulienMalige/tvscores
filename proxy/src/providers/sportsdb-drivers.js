import { getJson } from "../http.js";
import { surname } from "../photos.js";

const BASE = "https://www.thesportsdb.com/api/v1/json";
const DAY = 24 * 3600e3;

/**
 * The flags on a series' results: { surname: nationality } for everyone in
 * its teams on TheSportsDB, one list a day, a dozen calls for Formula 1. It
 * comes on the key we pay for, whose terms allow an app; Jolpica's driver
 * list, used before, is non-commercial (docs/motorsport-sources.md). A
 * refresh that fails keeps the last list.
 */
export function driverNationalities({ key, league = "Formula 1", get = getJson, now = Date.now }) {
  let known; // { at, map } once a list has come in
  return async () => {
    if (known && now() - known.at < DAY) return known.map;
    try {
      const { body } = await get(`${BASE}/${key}/search_all_teams.php?l=${encodeURIComponent(league)}`);
      const map = {};
      for (const team of body.teams || []) {
        const { body: roster } = await get(`${BASE}/${key}/lookup_all_players.php?id=${team.idTeam}`);
        for (const p of roster.player || []) if (p.strNationality) map[surname(p.strPlayer)] = p.strNationality;
      }
      known = { at: now(), map };
    } catch (err) {
      if (!known) throw err;
    }
    return known.map;
  };
}
