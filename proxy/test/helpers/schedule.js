import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../../src/cache.js";
import { TeamSportScheduler } from "../../src/scheduler.js";

/** A store on a fresh directory. */
export const tmpStore = () => new Store(mkdtempSync(join(tmpdir(), "tvscores-")));

export const CFG = {
  dailyRefreshHourUtc: 4,
  idleRefreshMinutes: 180,
  liveIntervalSeconds: 1800,
  quotaReserve: 8,
  dailyQuota: 100,
  liveWindowHours: 4,
};

export const KICKOFF = Date.parse("2026-09-15T20:00:00Z");
export const match = (over = {}) => ({
  id: "football:tsdb:1",
  sport: "football",
  league: { id: 4335, name: "La Liga", short: "LIGA" },
  kind: "match",
  start: new Date(KICKOFF).toISOString(),
  status: { state: "scheduled" },
  home: { name: "Elche", short: "ELC" },
  away: { name: "Oviedo", short: "OVI" },
  score: { home: null, away: null },
  ...over,
});

/** A provider that answers from what the test hands it, and counts its calls. */
export function fake({ daily = [], live = [], byDate = [] }) {
  const calls = { daily: 0, live: 0, byDate: 0 };
  return {
    calls,
    sport: "football",
    daily: async () => (calls.daily++, daily),
    live: async () => (calls.live++, live),
    byDate: async (d) => (calls.byDate++, calls.lastDate = d, byDate),
  };
}

export const scheduler = (provider) =>
  new TeamSportScheduler({ provider, store: new Store(mkdtempSync(join(tmpdir(), "tvscores-"))), cfg: CFG, log: () => {} });
