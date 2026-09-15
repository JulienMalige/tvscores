import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/cache.js";
import { TeamSportScheduler } from "../src/scheduler.js";

const CFG = {
  dayOffsets: [-1, 0, 1],
  dailyRefreshHourUtc: 4,
  idleRefreshMinutes: 180,
  liveIntervalSeconds: 1800,
  quotaReserve: 8,
  dailyQuota: 100,
  liveWindowHours: 4,
};

const KICKOFF = Date.parse("2026-09-15T20:00:00Z");
const match = (over = {}) => ({
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
function fake({ daily = [], live = [], byDate = [] }) {
  const calls = { daily: 0, live: 0, byDate: 0 };
  return {
    calls,
    sport: "football",
    daily: async () => (calls.daily++, daily),
    live: async () => (calls.live++, live),
    byDate: async (d) => (calls.byDate++, calls.lastDate = d, byDate),
  };
}

const scheduler = (provider) =>
  new TeamSportScheduler({ provider, store: new Store(mkdtempSync(join(tmpdir(), "tvscores-"))), cfg: CFG, log: () => {} });

test("nothing is polled until a kickoff is near", () => {
  const s = scheduler(fake({}));
  s.store.upsert([match()]);
  assert.equal(s.hasLiveWindow(KICKOFF - 60 * 60e3), false, "an hour before");
  assert.equal(s.hasLiveWindow(KICKOFF - 9 * 60e3), true, "nine minutes before: the window opens at ten");
  assert.equal(s.hasLiveWindow(KICKOFF + 2 * 3600e3), true, "two hours in");
});

test("a game nobody ever finished stops being polled, eventually", () => {
  // A provider that drops a match without ever calling it final would
  // otherwise hold the window open for ever — and the daily fetch with it.
  const s = scheduler(fake({}));
  s.store.upsert([match({ status: { state: "live", clock: "81'" } })]);
  assert.equal(s.hasLiveWindow(KICKOFF + 5 * 3600e3), true, "a long game is still a game");
  assert.equal(s.hasLiveWindow(KICKOFF + 8.1 * 3600e3), false, "but not eight hours later");
});

test("a fixture that never kicks off is dropped at the shorter cap", () => {
  const s = scheduler(fake({}));
  s.store.upsert([match()]);
  assert.equal(s.hasLiveWindow(KICKOFF + 3.9 * 3600e3), true);
  assert.equal(s.hasLiveWindow(KICKOFF + 4.1 * 3600e3), false);
});

test("a match that leaves the live feed has its final score read back from the day", async () => {
  // The livescore endpoint only lists games in progress, so a match that ends
  // simply disappears from it. Left alone, it would sit at "81'" for ever.
  const finished = match({ status: { state: "final" }, score: { home: 2, away: 1 } });
  const provider = fake({ live: [], byDate: [finished] });
  const s = scheduler(provider);
  s.store.upsert([match({ status: { state: "live", clock: "81'" } })]);

  await s.live(KICKOFF + 2 * 3600e3);

  assert.equal(provider.calls.byDate, 1, "the day is refetched");
  assert.equal(provider.calls.lastDate, "2026-09-15", "the match's own UTC date, not necessarily today");
  const [stored] = s.store.all();
  assert.equal(stored.status.state, "final");
  assert.deepEqual([stored.score.home, stored.score.away], [2, 1]);
});

test("the daily fetch waits while a game could be in progress", () => {
  const s = scheduler(fake({}));
  s.store.upsert([match({ status: { state: "live" } })]);
  s.meta.lastDaily = new Date(KICKOFF - 5 * 3600e3).toISOString(); // stale by the idle rule
  assert.equal(s.needsDaily(KICKOFF + 3600e3), false, "not while something is live");
  assert.equal(s.needsDaily(KICKOFF + 9 * 3600e3), true, "once the window has closed");
});

test("a failing upstream is asked less and less often, then forgiven", async () => {
  const angry = { sport: "football", daily: async () => { throw new Error("HTTP 429"); }, live: async () => [] };
  const s = scheduler(angry);
  const base = 5 * 60e3; // nothing live: the idle tick

  assert.equal(s.nextDelay(KICKOFF), base, "no failures yet");
  await s.tick();
  assert.equal(s.meta.failures, 1);
  assert.equal(s.nextDelay(KICKOFF), 2 * base, "one failure doubles it");
  await s.tick();
  assert.equal(s.nextDelay(KICKOFF), 4 * base);

  assert.ok(s.meta.lastError.message.includes("429"), "and the reason is kept for /v1/health");

  s.p.daily = async () => [];
  await s.tick();
  assert.equal(s.meta.failures, 0, "one good answer clears it");
  assert.equal(s.nextDelay(KICKOFF), base);
});

test("backoff stops at an hour, however long the outage", () => {
  const s = scheduler(fake({}));
  s.meta.failures = 40;
  assert.equal(s.nextDelay(KICKOFF), 60 * 60e3);
});
