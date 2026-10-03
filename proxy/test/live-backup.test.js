import test from "node:test";
import assert from "node:assert/strict";
import { LiveBackup, sameClub, statRows, eventRows } from "../src/providers/live-backup.js";
import { EventDetails } from "../src/details.js";

const event = { id: "football:tsdb:7", sport: "football", league: { id: 4351 }, start: "2026-10-03T21:30:00.000Z", status: { state: "live" }, home: { name: "Atlético Mineiro" }, away: { name: "Bragantino" } };
const fixture = { fixture: { id: 99, timestamp: Date.parse(event.start) / 1000 }, teams: { home: { id: 1, name: "Atletico-MG" }, away: { id: 2, name: "RB Bragantino" } } };

function backup(overrides = {}) {
  const calls = [];
  const fetch = async (url) => {
    calls.push(url.replace("https://v3.football.api-sports.io", ""));
    if (url.includes("live=all")) return { body: { response: [fixture] }, remaining: 90 };
    if (url.includes("statistics")) return { body: { response: [
      { statistics: [{ type: "Ball Possession", value: "42%" }, { type: "Fouls", value: 13 }] },
      { statistics: [{ type: "Ball Possession", value: "58%" }, { type: "Fouls", value: 4 }] }] } };
    return { body: { response: [
      { time: { elapsed: 18 }, team: { id: 1 }, type: "Goal", detail: "Normal Goal", player: { name: "Bernard" } },
      { time: { elapsed: 30 }, team: { id: 2 }, type: "Goal", detail: "Missed Penalty", player: { name: "Y" } },
      { time: { elapsed: 40 }, team: { id: 2 }, type: "subst", detail: "Substitution 1", player: { name: "Z" } }] } };
  };
  let clock = 0;
  const meta = { calls: { day: "", used: 0 } };
  return { calls, tick: (ms) => { clock += ms; }, meta, b: new LiveBackup({ key: "k", meta, fetch, now: () => clock, ...overrides }) };
}

test("clubs written two ways are one club", () => {
  assert.ok(sameClub("Atletico-MG", "Atlético Mineiro"));
  assert.ok(sameClub("RB Bragantino", "Bragantino"));
  assert.ok(!sameClub("Santos", "São Paulo"));
});

test("API-Sports' blocks become the rows details.js reads", () => {
  assert.deepEqual(statRows([{ statistics: [{ type: "Fouls", value: 1 }] }, { statistics: [{ type: "Fouls", value: 2 }] }]), [{ strStat: "Fouls", intHome: 1, intAway: 2 }]);
  const rows = eventRows([{ time: { elapsed: 45, extra: 2 }, team: { id: 2 }, type: "Card", detail: "Yellow Card", player: { name: "P" } }], 1);
  assert.deepEqual(rows, [{ strTimeline: "Card", strTimelineDetail: "Yellow Card", intTime: 47, strHome: "No", strPlayer: "P" }]);
});

test("a live Brasileirão game gets its statistics and goals from the backup", async () => {
  const { b, calls } = backup();
  const result = await b.detail(event);
  assert.deepEqual(result.stats.map((s) => [s.id, s.home, s.away]), [["possession", 42, 58], ["fouls", 13, 4]]);
  assert.deepEqual(result.timeline, [{ minute: 18, side: "home", kind: "goal", player: "Bernard" }], "no missed penalty, no substitution");
  assert.equal(calls.length, 3, "the live list, statistics, events");
});

test("one game is asked again no sooner than five minutes, and the fixture is remembered", async () => {
  const { b, calls, tick } = backup();
  await b.detail(event);
  tick(120e3);
  await b.detail(event);
  assert.equal(calls.length, 3);
  tick(200e3);
  await b.detail(event);
  assert.equal(calls.length, 5, "statistics and events again, not the list");
});

test("the backup stops at the day's budget less its reserve", async () => {
  const { b, calls } = backup({ dailyQuota: 12, quotaReserve: 10 });
  const result = await b.detail(event);
  assert.equal(calls.length, 2, "only two calls were spendable: the list and the statistics");
  assert.equal(result, undefined, "half a page is not served; TheSportsDB's answer stands");
});

test("other leagues and games not in play are left to TheSportsDB", () => {
  const { b } = backup();
  assert.ok(b.covers(event));
  assert.ok(!b.covers({ ...event, league: { id: 4328 } }));
  assert.ok(!b.covers({ ...event, status: { state: "final" } }));
});

test("a game's page falls back to the backup only when TheSportsDB had nothing", async () => {
  const { b } = backup();
  const store = { events: new Map([[event.id, event]]), standings: {} };
  const empty = async () => ({ body: {} });
  const details = new EventDetails({ key: "k", store, fetch: empty, timers: false, backup: b });
  const body = await details.get(event.id);
  assert.equal(body.stats.length, 2);
  assert.equal(body.timeline.length, 1);
});

test("what the backup found stays on the page after the whistle and when the budget runs out", async () => {
  const { b, tick } = backup();
  await b.detail(event);
  assert.equal(b.last({ ...event, status: { state: "final" } }).stats.length, 2, "kept for a finished game");
  tick(400e3);
  b.quota.dailyQuota = 0; // the day's calls are spent
  const again = await b.detail(event);
  assert.equal(again.stats.length, 2, "the last good answer, not an empty page");
  assert.equal(again.timeline.length, 1);
});
