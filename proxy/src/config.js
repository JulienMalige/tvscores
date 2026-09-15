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
  apiSportsKey: readKey("TVSCORES_APISPORTS_KEY", "api-sports.key"),
  liveTennisKey: readKey("TVSCORES_LIVETENNIS_KEY", "livetennisapi.key"),
  ocBlacktopKey: readKey("TVSCORES_OCBLACKTOP_KEY", "ocblacktop.key"),
  /** TheSportsDB key for athlete cutouts; "3" is the public test key, swap for the paid one before release. */
  theSportsDbKey: env.TVSCORES_TSDB_KEY || "3",
  /** Optional URL prefix the reverse proxy leaves on the path (Tailscale serve --set-path). */
  pathPrefix: env.TVSCORES_PATH_PREFIX || "/tvscores",
  /** Public base the app reaches us at; used for asset URLs in responses. */
  publicBase: env.TVSCORES_PUBLIC_BASE || "https://srv1822832.tailf78112.ts.net/tvscores",
  /**
   * Which competitions to keep, per provider. `badge` names a trimmed PNG in
   * proxy/assets/leagues (built by scripts/build-badges.py) served by this proxy.
   */
  leagues: {
    football: [
      { id: 39, name: "Premier League", short: "PL", badge: "epl" },
      { id: 2, name: "UEFA Champions League", short: "UCL", badge: "ucl" },
    ],
    nfl: [{ id: 1, name: "NFL", short: "NFL", badge: "nfl" }],
    nba: [{ id: "standard", name: "NBA", short: "NBA", badge: "nba" }],
    f1: [{ id: "f1", name: "Formula 1", short: "F1", badge: "f1" }],
    motogp: [{ id: "motogp", name: "MotoGP", short: "MotoGP", badge: "motogp" }],
    tennis: [
      { id: "atp", name: "ATP Tour", short: "ATP", badge: "atp" },
      { id: "wta", name: "WTA Tour", short: "WTA", badge: "wta" },
    ],
  },
  /** Display order of sports on the scoreboard. */
  sportOrder: ["football", "f1", "motogp", "tennis", "nba", "nfl"],
  schedule: {
    /** Free plan: dates yesterday..tomorrow only, 100 calls/day per sport. */
    dayOffsets: [-1, 0, 1],
    dailyRefreshHourUtc: 4,
    idleRefreshMinutes: 180,
    /**
     * How often a sport with a game in progress is polled. Julien's brief
     * (2026-09-15): this is a "what is on today" app, not a live-timing one —
     * every 30 minutes now, perhaps 10 later. The quota stretches this floor
     * further when the day's budget would not survive it.
     */
    liveIntervalSeconds: 1800,
    /** Never spend the last N calls of a sport's daily quota. */
    quotaReserve: 8,
    dailyQuota: 100,
    /** How far ahead the Upcoming tab looks, in local days. */
    upcomingDays: 7,
    /** A game counts as "maybe live" from 10 min before kickoff until this long after. */
    liveWindowHours: 4,
    /** Orange Cat Blacktop free tier is 7,500/month; keep a day well under that. */
    ocbDailyQuota: 200,
  },
};
