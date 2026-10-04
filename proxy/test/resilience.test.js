import test from "node:test";
import assert from "node:assert/strict";
import { CalendarScheduler } from "../src/calendar-scheduler.js";
import { KICKOFF, match, fake, scheduler, tmpStore } from "./helpers/schedule.js";

const NIGHT = Date.parse("2026-09-16T04:30:00Z"); // the day has changed, a game from last night still counts as live
const live = () => match({ status: { state: "live", clock: "70'" } });
const lateGame = () => match({ start: "2026-09-15T22:00:00Z", status: { state: "live", clock: "80'" } });

test("a table endpoint having a bad day does not slow the scores", async () => {
  let asked = 0;
  const p = fake({ live: [live()] });
  p.standings = async () => { asked += 1; throw new Error("tables are down"); };
  const s = scheduler(p);
  await s.tick();
  clearTimeout(s.timer);
  assert.equal(s.meta.failures || 0, 0, "the live feed's failure count is the live feed's");
  assert.equal(s.meta.lastError, undefined, "and what it last said is not about the tables");
  assert.ok(s.meta.standingsEmpty && s.meta.lastStandings, "the tables are marked to retry in half an hour");
  await s.tick();
  clearTimeout(s.timer);
  assert.equal(asked, 1, "and are not asked for again at the very next tick");
});

test("a disk that will not take the save does not stop the loop", async () => {
  const s = scheduler(fake({ daily: [match()] }));
  s.store.save = () => { throw new Error("ENOSPC"); };
  const timers = [];
  const real = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms) => { const t = real(() => {}, 0); timers.push(ms); return t; };
  try {
    await s.tick();
  } finally {
    globalThis.setTimeout = real;
  }
  assert.equal(timers.length, 1, "the next tick is armed all the same");
});

test("the store is written at most every so often, and at once when asked to stop", () => {
  const store = tmpStore();
  store.touch();
  store.save({ every: 60e3 });
  assert.equal(store.dirty, false, "the first save wrote");
  store.touch();
  store.save({ every: 60e3 });
  assert.equal(store.dirty, true, "the second, a moment later, waited");
  store.save();
  assert.equal(store.dirty, false, "an ordinary save (the shutdown's) is never held back");
});

test("a new day waits for the live window to shut, but not for ever", () => {
  const s = scheduler(fake({}));
  s.store.upsert([lateGame()]);
  s.meta.lastDaily = new Date(KICKOFF - 3600e3).toISOString();
  assert.equal(s.hasLiveWindow(NIGHT), true);
  assert.equal(s.needsDaily(NIGHT), false, "the day changed, a game is on: not now");
  s.meta.lastDaily = new Date(NIGHT - 37 * 3600e3).toISOString();
  assert.equal(s.needsDaily(NIGHT), true, "a day and a half without one: whatever is on");
  s.store.events.clear();
  s.meta.lastDaily = new Date(KICKOFF - 3600e3).toISOString();
  assert.equal(s.needsDaily(NIGHT), true, "and with the window shut it is the new day's");
});

test("a pass that came back short is finished in half an hour", async () => {
  const rows = [match()];
  rows.partial = true;
  const s = scheduler(fake({ daily: rows }));
  const now = KICKOFF - 5 * 3600e3;
  await s.daily(now);
  assert.ok(s.meta.retryDailyAfter, "marked unfinished");
  assert.equal(s.needsDaily(now + 10 * 60e3), false, "not at once");
  assert.equal(s.needsDaily(now + 31 * 60e3), true, "and asked for again after thirty minutes");
  s.p.daily = async () => [match()];
  await s.daily(now + 31 * 60e3);
  assert.equal(s.meta.retryDailyAfter, undefined, "a whole pass clears it");
});

test("a team named without its crest keeps the crest the first look found", () => {
  const store = tmpStore();
  store.upsert([match({ home: { name: "Elche", short: "ELC", logo: "https://cdn/elche.png" } })]);
  store.upsert([match({ status: { state: "live" }, home: { name: "Elche", short: "ELC", logo: undefined } })]);
  assert.equal(store.events.get("football:tsdb:1").home.logo, "https://cdn/elche.png");
  assert.equal(store.events.get("football:tsdb:1").status.state, "live", "and the rest is the second look's");
});

test("games that ended are looked for every five minutes on a big budget, twenty on a small one", async () => {
  const big = scheduler(fake({ live: [], byDate: [] }));
  big.quota.dailyQuota = 5000;
  big.store.upsert([live()]);
  await big.live(KICKOFF + 3 * 3600e3);
  assert.equal(big.p.calls.byDate, 1);
  await big.live(KICKOFF + 3 * 3600e3 + 6 * 60e3);
  assert.equal(big.p.calls.byDate, 2, "six minutes on, asked again");
  const small = scheduler(fake({ live: [], byDate: [] }));
  small.store.upsert([live()]);
  await small.live(KICKOFF + 3 * 3600e3);
  await small.live(KICKOFF + 3 * 3600e3 + 6 * 60e3);
  assert.equal(small.p.calls.byDate, 1, "on a hundred a day it waits twenty");
});

function calendarProvider(seasons) {
  let n = 0;
  return { sport: "f1", season: async () => seasons[Math.min(n++, seasons.length - 1)] };
}

test("an empty calendar does not wipe the season we hold", async () => {
  const store = tmpStore();
  const round = { id: "f1:1", sport: "f1", kind: "race", start: "2026-10-04T12:00:00Z", status: { state: "scheduled" }, league: { id: "f1" } };
  store.upsert([round]);
  const s = new CalendarScheduler({ provider: calendarProvider([[]]), store, log: () => {}, quota: { spendable: () => 10 } });
  await s.tick();
  clearTimeout(s.timer);
  assert.equal(store.events.size, 1, "the rounds stay");
  assert.match(s.meta.lastError.message, /empty calendar/);
});

test("the stamp that says a classification was asked for survives a calendar refresh", async () => {
  const store = tmpStore();
  const done = { id: "f1:1", sport: "f1", kind: "race", start: "2026-09-01T12:00:00Z", status: { state: "final" }, league: { id: "f1" } };
  store.upsert([{ ...done, resultsFetchedAt: "2026-09-02T00:00:00Z", results: [] }]);
  const s = new CalendarScheduler({ provider: calendarProvider([[{ ...done }]]), store, log: () => {}, quota: { spendable: () => 10 } });
  await s.tick();
  clearTimeout(s.timer);
  assert.equal(store.events.get("f1:1").resultsFetchedAt, "2026-09-02T00:00:00Z");
  assert.equal(store.hasResults("f1:1"), true, "so it is not asked for every other tick");
});
