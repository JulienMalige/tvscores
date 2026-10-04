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

test("a rate limit does not use up a match's tries, and stops the round", async () => {
  const seen = (i) => match({ id: `tennis:${i}`, sport: "tennis", status: { state: "live" } });
  const asked = [];
  const limited = Object.assign(new Error("HTTP 429"), { status: 429 });
  const provider = { sport: "tennis", finalizeOrphans: true, live: async () => [], byId: async (id) => { asked.push(id); throw limited; } };
  const s = scheduler(provider);
  s.store.upsert([seen(1), seen(2), seen(3)]);
  for (let round = 1; round <= 5; round++) await s.live(KICKOFF + round * 1800e3);
  assert.equal(asked.length, 5, "one ask a round, not eight: the first refusal ends the round");
  assert.equal(s.meta.toConfirm.length, 3, "and all three are still waiting");
  assert.ok(s.meta.toConfirm.every((e) => e.tries === 0), "none of them has a try used");
});

test("a match with no readable time is left out, not given the time of the poll", async () => {
  const { normaliseMatch } = await import("../src/providers/livetennis-match.js");
  const row = { id: 1, tour: "atp", status: "upcoming", players: { p1: { name: "A" }, p2: { name: "B" } } };
  assert.equal(normaliseMatch(row, {}), null, "no time at all");
  assert.equal(normaliseMatch({ ...row, scheduled_time: "not a time" }, {}), null, "a time that is not one");
  assert.ok(normaliseMatch({ ...row, scheduled_time: "2026-10-03T10:00:00Z" }, {}), "a good one");
});

test("a catalogue that always says there is more is read twenty pages and no further", async (t) => {
  const { tennisProvider } = await import("../src/providers/livetennis.js");
  let pages = 0;
  t.mock.method(globalThis, "fetch", async (url) => {
    if (url.includes("/tournaments")) { pages += 1; return new Response(JSON.stringify({ data: [{ id: pages, name: "T", tour: "atp" }], meta: { has_more: true } })); }
    return new Response(JSON.stringify({ data: [] }));
  });
  const spent = [];
  const p = tennisProvider({ key: "k", quota: { record: () => spent.push(1) }, meta: {}, tennis: { categories: [], alsoBig: [], calendar: [] }, log: () => {} });
  await p.byId("tennis:1").catch(() => {});
  assert.equal(pages, 40, "twenty pages for each of the two tours, and it ended");
});

test("a listed match that never went live is let go twelve hours past its time", async () => {
  const gone = match({ id: "tennis:5", sport: "tennis" });
  const s = scheduler({ sport: "tennis", live: async () => [], finalizeOrphans: true });
  s.store.upsert([gone]);
  await s.live(KICKOFF + 11 * 3600e3);
  assert.equal(s.store.events.size, 1, "eleven hours: still there");
  await s.live(KICKOFF + 13 * 3600e3);
  assert.equal(s.store.events.size, 0, "thirteen: it was a walkover, and is gone");
});

test("a photo lookup that is refused is still counted, and the day's line is kept", async (t) => {
  const { PhotoResolver, DAILY_LINE } = await import("../src/photos.js");
  t.mock.method(globalThis, "fetch", async () => new Response("", { status: 429 }));
  const photos = new PhotoResolver({ store: tmpStore(), key: "k", log: () => {} });
  await assert.rejects(() => photos.lookup("Some Name", "f1"));
  assert.equal(photos.meta.calls.used, 1, "the refusal was a call");
  assert.equal(photos.quota.dailyQuota, DAILY_LINE);
});

test("a rate limit holds a match for a day at most, and a server error on one id counts as its failure", async () => {
  const seen = match({ id: "tennis:9", sport: "tennis", status: { state: "live" } });
  const limited = Object.assign(new Error("HTTP 429"), { status: 429 });
  const broken = Object.assign(new Error("HTTP 500"), { status: 500 });
  let failure = limited;
  const provider = { sport: "tennis", finalizeOrphans: true, live: async () => [], byId: async () => { throw failure; } };
  const s = scheduler(provider);
  s.store.upsert([seen]);
  await s.live(KICKOFF + 1800e3);
  assert.equal(s.meta.toConfirm.length, 1, "held");
  await s.live(KICKOFF + 25 * 3600e3);
  assert.equal(s.meta.toConfirm, undefined, "and let go after a day of refusals");
  const t = scheduler(provider);
  failure = broken;
  t.store.upsert([seen, match({ id: "tennis:10", sport: "tennis", status: { state: "live" } })]);
  for (let round = 1; round <= 4; round++) await t.live(KICKOFF + round * 1800e3);
  assert.equal(t.meta.toConfirm, undefined, "a dead id is let go after its three tries, and does not stop the others being asked");
});

test("a daily pass stops at a 429, and the second ask is for the dates it missed", async () => {
  const dates = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"];
  const asked = [];
  const refused = Object.assign(new Error("HTTP 429"), { status: 429 });
  const rows = [match()];
  rows.partial = true;
  rows.missing = dates.slice(2);
  const p = fake({});
  p.daily = async (opts) => { asked.push(opts?.dates); return asked.length === 1 ? rows : [match()]; };
  const s = scheduler(p);
  const now = KICKOFF - 5 * 3600e3;
  await s.daily(now);
  assert.deepEqual(s.meta.retryDates, ["2026-10-03", "2026-10-04"]);
  await s.daily(now + 31 * 60e3);
  assert.deepEqual(asked, [undefined, ["2026-10-03", "2026-10-04"]], "the first asks for the window, the second only for what is missing");
  assert.equal(s.meta.retryDates, undefined, "and a whole pass clears it");
  assert.ok(refused.status);
});

test("a tour's day-change pass does not wait for a window that never shuts, and a team sport's waits six hours at most", () => {
  const tour = scheduler({ ...fake({}), sport: "tennis", alwaysLive: true });
  tour.store.upsert([lateGame()]);
  tour.meta.lastDaily = new Date(KICKOFF - 3600e3).toISOString();
  assert.equal(tour.needsDaily(NIGHT), true, "tomorrow's order of play is how new matches appear");
  const team = scheduler(fake({}));
  team.store.upsert([match({ start: "2026-09-16T04:00:00Z", status: { state: "live" } })]);
  team.meta.lastDaily = new Date(KICKOFF - 3600e3).toISOString();
  assert.equal(team.needsDaily(Date.parse("2026-09-16T05:00:00Z")), false, "an hour after the refresh hour, a game on: it waits");
  assert.equal(team.needsDaily(Date.parse("2026-09-16T10:30:00Z")), true, "six hours on, a window still open: it goes ahead");
});

test("a live match whose payload has no time keeps the poll's, an upcoming one is left out, an epoch is a time", async () => {
  const { normaliseMatch } = await import("../src/providers/livetennis-match.js");
  const base = { id: 1, tour: "atp", players: { p1: { name: "A" }, p2: { name: "B" } } };
  assert.ok(normaliseMatch({ ...base, status: "live" }, {}), "in play, so it is shown");
  assert.equal(normaliseMatch({ ...base, status: "upcoming" }, {}), null);
  const epoch = Date.parse("2026-10-03T10:00:00Z");
  assert.equal(normaliseMatch({ ...base, status: "upcoming", scheduled_time: epoch }, {}).start, "2026-10-03T10:00:00.000Z");
});

test("a team slot that turns out to be another club does not keep the first club's crest", () => {
  const store = tmpStore();
  store.upsert([match({ home: { name: "Winner of A", short: "WIN", logo: "https://cdn/a.png" } })]);
  store.upsert([match({ home: { name: "Elche", short: "ELC", logo: undefined } })]);
  assert.equal(store.events.get("football:tsdb:1").home.logo, undefined);
  assert.equal(store.events.get("football:tsdb:1").home.name, "Elche");
});

test("an event with no readable start is not kept, whoever hands it over", () => {
  const store = tmpStore();
  store.upsert([match({ id: "football:tsdb:7", start: "not a date" }), match()]);
  assert.deepEqual([...store.events.keys()], ["football:tsdb:1"]);
});
