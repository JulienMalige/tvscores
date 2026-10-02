import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/cache.js";
import { TeamSportScheduler, CalendarScheduler } from "../src/scheduler.js";

const CFG = {
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

test("a race weekend is watched; the fortnight between is not", () => {
  const store = new Store(mkdtempSync(join(tmpdir(), "tvscores-")));
  const s = new CalendarScheduler({ provider: { sport: "f1" }, store, log: () => {}, quota: null });
  const race = Date.parse("2026-09-20T13:00:00Z");
  store.upsert([{ id: "f1:1", sport: "f1", kind: "race", start: new Date(race).toISOString(), status: { state: "scheduled" } }]);

  assert.equal(s.nextDelay(race - 2 * 3600e3), 30 * 60e3, "two hours before the lights");
  assert.equal(s.nextDelay(race + 3 * 3600e3), 30 * 60e3, "and while the results are settling");
  assert.equal(s.nextDelay(race - 3 * 86400e3), 6 * 3600e3, "but three days out, six-hourly");
});

test("a result marks its league's table stale, and only where results make the table", async () => {
  const done = match({ status: { state: "final" }, score: { home: 2, away: 1 } });
  const s = scheduler({ ...fake({ live: [done] }), standingsFollowResults: true });
  await s.live(KICKOFF + 2 * 3600e3);
  assert.deepEqual([...s.dirtyLeagues], ["4335"], "the league that just finished a game");

  // Tennis: the rankings move weekly, not when a match ends.
  const t = scheduler(fake({ live: [done] }));
  await t.live(KICKOFF + 2 * 3600e3);
  assert.equal(t.dirtyLeagues.size, 0);
});

test("a game that kicked off but never appeared live is fetched again", async () => {
  // The live feed carries games it knows about. One it never reports stays
  // as we last saw it — "19:30, no score" — because the only other correction
  // is the daily pass, and that waits for the live window to close.
  const played = match({ status: { state: "final" }, score: { home: 1, away: 2 } });
  const provider = fake({ live: [], byDate: [played] });
  const s = scheduler(provider);
  s.store.upsert([match()]); // still scheduled, kickoff two hours ago

  await s.live(KICKOFF + 2 * 3600e3);

  assert.equal(provider.calls.byDate, 1, "its own date is refetched");
  assert.equal(s.store.all()[0].status.state, "final");
  assert.deepEqual(s.store.all()[0].score, { home: 1, away: 2 });
});

test("a fixture still to come is left alone", async () => {
  const provider = fake({ live: [] });
  const s = scheduler(provider);
  s.store.upsert([match()]);
  await s.live(KICKOFF - 5 * 60e3);
  assert.equal(provider.calls.byDate, 0, "five minutes before kickoff is not overdue");
  await s.live(KICKOFF + 5 * 60e3);
  assert.equal(provider.calls.byDate, 0, "and neither is five minutes after");
});

test("a provider with no byDate is not asked for one", async () => {
  const provider = { sport: "tennis", live: async () => [], finalizeOrphans: true };
  const s = scheduler(provider);
  s.store.upsert([match({ id: "tennis:1", sport: "tennis" })]);
  await s.live(KICKOFF + 3 * 3600e3); // would throw if it tried
});

test("a provider that plays all day is polled live with nothing tracked", async () => {
  // Reproduction, 28 September: no tennis tracked, so no live window, so the
  // live feed was never asked, and the Beijing matches under way never came.
  const row = match({ id: "tennis:lt:1", sport: "tennis", status: { state: "live" } });
  const provider = { ...fake({ live: [row] }), sport: "tennis" };
  const s = scheduler(provider);
  assert.equal(s.hasLiveWindow(KICKOFF), false, "nothing tracked");
  assert.equal(s.pollsLive(KICKOFF), false, "a team sport waits for a kickoff");
  provider.alwaysLive = true;
  assert.equal(s.pollsLive(KICKOFF), true, "a tour does not");
  await s.tick();
  assert.equal(provider.calls.live, 1);
  assert.equal(s.events().length, 1, "the match under way is tracked");
});

test("a match gone from the live feed is asked for by id to learn how it ended", async () => {
  // Reproduction, 2 October: Udvardy lost 2-6 3-6, and the board said 0-1 —
  // the last look, half an hour before the end, kept as the result.
  const seen = match({ id: "tennis:196994", sport: "tennis", status: { state: "live", clock: "Set 2 · 3-4" }, score: { home: 0, away: 1, sets: [[2, 6], [3, 4]] } });
  const ended = { ...seen, status: { state: "final" }, score: { home: 0, away: 2, sets: [[2, 6], [3, 6]] } };
  const asked = [];
  const provider = { sport: "tennis", finalizeOrphans: true, live: async () => [], byId: async (id) => { asked.push(id); return ended; } };
  const s = scheduler(provider);
  s.store.upsert([seen]);
  await s.live(KICKOFF + 3600e3);
  assert.deepEqual(asked, ["tennis:196994"]);
  const row = s.events().find((e) => e.id === "tennis:196994");
  assert.equal(row.status.state, "final");
  assert.deepEqual(row.score, { home: 0, away: 2, sets: [[2, 6], [3, 6]] });
  assert.equal(s.meta.toConfirm, undefined, "nothing left to ask");
});

test("finished matches past a round's share wait for the next round", async () => {
  const live = Array.from({ length: 10 }, (_, i) => match({ id: `tennis:${i}`, sport: "tennis", status: { state: "live" } }));
  const asked = [];
  const provider = { sport: "tennis", finalizeOrphans: true, live: async () => [], byId: async (id) => { asked.push(id); return { ...live[0], id, status: { state: "final" } }; } };
  const s = scheduler(provider);
  s.store.upsert(live);
  await s.live(KICKOFF + 3600e3);
  assert.equal(asked.length, 8);
  assert.deepEqual(s.meta.toConfirm.map((e) => e.id), ["tennis:8", "tennis:9"]);
  await s.live(KICKOFF + 2 * 3600e3);
  assert.equal(asked.length, 10);
  assert.equal(s.meta.toConfirm, undefined);
});

test("a match that keeps failing is let go after three tries", async () => {
  // Review, build 32: a dead id was asked for eight times a round for ever.
  const seen = match({ id: "tennis:404", sport: "tennis", status: { state: "live" } });
  let calls = 0;
  const provider = { sport: "tennis", finalizeOrphans: true, live: async () => [], byId: async () => { calls++; throw new Error("HTTP 500"); } };
  const s = scheduler(provider);
  s.store.upsert([seen]);
  for (let round = 1; round <= 5; round++) await s.live(KICKOFF + round * 1800e3);
  assert.equal(calls, 3);
  assert.equal(s.meta.toConfirm, undefined);
});

test("a match the feed no longer knows is asked for once", async () => {
  const seen = match({ id: "tennis:gone", sport: "tennis", status: { state: "live" } });
  let calls = 0;
  const provider = { sport: "tennis", finalizeOrphans: true, live: async () => [], byId: async () => { calls++; return null; } };
  const s = scheduler(provider);
  s.store.upsert([seen]);
  await s.live(KICKOFF + 1800e3);
  await s.live(KICKOFF + 3600e3);
  assert.equal(calls, 1);
});
