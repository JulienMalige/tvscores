import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const env = process.env;

function readKey(envName, fileName) {
  if (env[envName]) return env[envName].trim();
  const file = env[`${envName}_FILE`] || join(homedir(), ".config/tvscores", fileName);
  try {
    return readFileSync(file, "utf8").trim();
  } catch {
    return "";
  }
}

export const config = {
  host: env.TVSCORES_HOST || "127.0.0.1",
  port: Number(env.TVSCORES_PORT || 8787),
  cacheDir: env.TVSCORES_CACHE_DIR || join(homedir(), ".local/state/tvscores"),
  liveTennisKey: readKey("TVSCORES_LIVETENNIS_KEY", "livetennisapi.key"),
  ocBlacktopKey: readKey("TVSCORES_OCBLACKTOP_KEY", "ocblacktop.key"),
  /** TheSportsDB key for athlete cutouts and schedules; "3" is the public test key, capped so hard it is unusable for anything but a demo. */
  theSportsDbKey: readKey("TVSCORES_TSDB_KEY", "thesportsdb.key") || "3",
  /** Optional URL prefix the reverse proxy leaves on the path (Tailscale serve --set-path). */
  pathPrefix: env.TVSCORES_PATH_PREFIX || "/tvscores",
  /** Public base the app reaches us at; used for asset URLs in responses. */
  publicBase: env.TVSCORES_PUBLIC_BASE || "https://srv1822832.tailf78112.ts.net/tvscores",
  /**
   * Which competitions to keep, per provider. `badge` names a trimmed PNG in
   * proxy/assets/leagues (built by scripts/build-badges.py) served by this proxy.
   */
  leagues: {
    /**
     * TheSportsDB league ids (2026-09-15). Football is fetched one call per
     * date and filtered here, so a competition costs a line and a badge, not
     * a subscription. Ids verified against the live catalogue, and the
     * ordering is the order they appear on the scoreboard.
     */
    football: [
      { id: 4328, name: "Premier League", short: "PL", badge: "epl" },
      { id: 4335, name: "La Liga", short: "LIGA", badge: "laliga" },
      { id: 4332, name: "Serie A", short: "SA", badge: "seriea" },
      { id: 4331, name: "Bundesliga", short: "BUN", badge: "bundesliga" },
      { id: 4334, name: "Ligue 1", short: "L1", badge: "ligue1" },
      // `menu` is the name where a sidebar row is too narrow for the full one.
      // tvOS lays those rows out itself and wraps rather than truncating, so a
      // long name costs a second line; this is cheaper than fighting it.
      // The feed has results for the cups but no table, so theirs is built
      // from the league phase — rounds 1 to 8; qualifying is round 0.
      { id: 4480, name: "UEFA Champions League", menu: "Champions League", short: "UCL", badge: "ucl", table: { rounds: [1, 8], scoring: "points" } },
      { id: 4481, name: "UEFA Europa League", menu: "Europa League", short: "UEL", badge: "uel", table: { rounds: [1, 8], scoring: "points" } },
      { id: 4501, name: "Copa Libertadores", short: "LIB", badge: "libertadores" },
      { id: 4351, name: "Brasileirão", short: "BRA", badge: "brasileirao" },
    ],
    // Records built from results, split by conference (src/divisions.js):
    // the NFL's regular season is rounds 1 to 18, preseason and playoffs
    // sit at 500 and 150+; the NBA numbers every regular-season game 0.
    nfl: [{ id: 4391, name: "NFL", short: "NFL", badge: "nfl", table: { rounds: [1, 18], scoring: "record", groups: "nfl" } }],
    nba: [{ id: 4387, name: "NBA", short: "NBA", badge: "nba", table: { rounds: [0, 0], scoring: "record", groups: "nba" } }],
    f1: [{ id: "f1", name: "Formula 1", short: "F1", badge: "f1" }],
    motogp: [{ id: "motogp", name: "MotoGP", short: "MotoGP", badge: "motogp" }],
    tennis: [
      { id: "atp", name: "ATP Tour", short: "ATP", badge: "atp" },
      { id: "wta", name: "WTA Tour", short: "WTA", badge: "wta" },
    ],
  },
  /**
   * Tennis plays somewhere every week of the year, most of it in front of
   * nobody. These are the events worth a television: the four majors, the
   * 1000-level fields and the season finals. The feed labels a tournament's
   * category only where its own catalogues agree on an exact-name join and
   * never guesses from the name, so an unlabelled tournament is left out
   * rather than assumed to be big.
   */
  tennis: {
    categories: ["grand_slam", "masters_1000", "tour_finals", "wta_1000"],
    /** Qualifying draws are the same tournament but not the part you watch. */
    includeQualifying: false,
    /**
     * The 1000s their catalogue misses or mislabels, pinned by id because a
     * name match is what mislabelled them: Madrid and Rome come back as `itf`
     * (both cities host an ITF week of the same name) and the rest as `null`.
     * Each tournament has two ids, one per event type, and both are listed.
     * Checked 2026-09-15; ATP Doha and ATP Beijing are 500s and stay out.
     */
    alsoBig: [
      1262, 1970, // Monte Carlo
      1269, 2004, // Madrid (ATP)
      1270, 2011, // Rome (ATP)
      1667, 8656, // Shanghai
      2078, 7607, // Montreal (ATP, alternates with Toronto)
      1268, 2003, // Madrid (WTA)
      1271, 2010, // Rome (WTA)
      1651, 8654, // Beijing (WTA)
      1241, 1853, // Doha (WTA)
      1517, 1533, // Montreal (WTA)
    ],
  },
  /** Display order of sports on the scoreboard. */
  sportOrder: ["football", "f1", "motogp", "tennis", "nba", "nfl"],
  schedule: {
    /**
     * The days every team sport is fetched for, one call each: yesterday for
     * last night's finals, and the seven the Upcoming tab shows.
     */
    teamSportWindow: { back: 1, ahead: 7 },
    dailyRefreshHourUtc: 4,
    idleRefreshMinutes: 180,
    /**
     * How often a sport with a game in progress is polled, per sport, because
     * their budgets are not alike. The three on TheSportsDB share a key capped
     * per *minute*, so half a minute apart — half the feed's own 60 s period,
     * see proxy/README.md — costs them nothing: a full twelve-hour Saturday is
     * 1,440 calls against a ceiling of 100 a minute. Tennis is still on a
     * 100-a-day key and stays slow. The quota stretches any of these further
     * when the day's budget would not survive it.
     */
    liveIntervalSeconds: { default: 1800, football: 30, nfl: 30, nba: 30, tennis: 1800 },
    /** Never spend the last N calls of a sport's daily quota. */
    quotaReserve: 8,
    dailyQuota: 100,
    /** How far ahead the Upcoming tab looks, in local days. */
    upcomingDays: 7,
    /** A game counts as "maybe live" from 10 min before kickoff until this long after. */
    liveWindowHours: 4,
    /** TheSportsDB paid tiers cap requests per minute, not per day; this is a sanity ceiling. */
    sportsDbDailyQuota: 5000,
    /** Orange Cat Blacktop free tier is 7,500/month; keep a day well under that. */
    ocbDailyQuota: 200,
  },
};
