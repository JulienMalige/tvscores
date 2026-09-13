import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const env = process.env;

function readKey() {
  if (env.TVSCORES_APISPORTS_KEY) return env.TVSCORES_APISPORTS_KEY.trim();
  const file = env.TVSCORES_APISPORTS_KEY_FILE || join(homedir(), ".config/tvscores/api-sports.key");
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
  apiSportsKey: readKey(),
  /** Optional URL prefix the reverse proxy leaves on the path (Tailscale serve --set-path). */
  pathPrefix: env.TVSCORES_PATH_PREFIX || "/tvscores",
  /** Which competitions to keep, per provider. */
  leagues: {
    football: [{ id: 2, name: "UEFA Champions League", short: "UCL" }],
    nfl: [{ id: 1, name: "NFL", short: "NFL" }],
    nba: [{ id: "standard", name: "NBA", short: "NBA" }],
    f1: [{ id: "f1", name: "Formula 1", short: "F1" }],
  },
  /** Display order of sports on the scoreboard. */
  sportOrder: ["football", "f1", "nba", "nfl"],
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
  },
};
