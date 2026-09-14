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
  /** Optional URL prefix the reverse proxy leaves on the path (Tailscale serve --set-path). */
  pathPrefix: env.TVSCORES_PATH_PREFIX || "/tvscores",
  /**
   * Which competitions to keep, per provider. League badges are hotlinked from
   * TheSportsDB (light-on-dark variants); before the store release either host
   * copies or take their $9 tier, see docs/data-providers.md.
   */
  leagues: {
    football: [{ id: 2, name: "UEFA Champions League", short: "UCL", logo: "https://r2.thesportsdb.com/images/media/league/badge/facv1u1742998896.png" }],
    nfl: [{ id: 1, name: "NFL", short: "NFL", logo: "https://r2.thesportsdb.com/images/media/league/badge/g85fqz1662057187.png" }],
    nba: [{ id: "standard", name: "NBA", short: "NBA", logo: "https://r2.thesportsdb.com/images/media/league/badge/frdjqy1536585083.png" }],
    f1: [{ id: "f1", name: "Formula 1", short: "F1", logo: "https://r2.thesportsdb.com/images/media/league/badge/g8cofl1513623681.png" }],
    motogp: [{ id: "motogp", name: "MotoGP", short: "MotoGP", logo: "https://r2.thesportsdb.com/images/media/league/badge/gg3c201768486075.png" }],
    tennis: [
      { id: "atp", name: "ATP Tour", short: "ATP", logo: "https://r2.thesportsdb.com/images/media/league/badge/q7aej51769857150.png" },
      { id: "wta", name: "WTA Tour", short: "WTA", logo: "https://r2.thesportsdb.com/images/media/league/badge/bddhun1768230678.png" },
    ],
  },
  /** Display order of sports on the scoreboard. */
  sportOrder: ["football", "f1", "motogp", "tennis", "nba", "nfl"],
  schedule: {
    /** Free plan: dates yesterday..tomorrow only, 100 calls/day per sport. */
    dayOffsets: [-1, 0, 1],
    dailyRefreshHourUtc: 4,
    idleRefreshMinutes: 180,
    liveIntervalSeconds: 150,
    /** Never spend the last N calls of a sport's daily quota. */
    quotaReserve: 8,
    dailyQuota: 100,
    /** A game counts as "maybe live" from 10 min before kickoff until this long after. */
    liveWindowHours: 4,
    /** Orange Cat Blacktop free tier is 7,500/month; keep a day well under that. */
    ocbDailyQuota: 200,
  },
};
