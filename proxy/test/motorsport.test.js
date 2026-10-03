import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normaliseEvent, lapSeconds } from "../src/providers/ocblacktop.js";
import { sessionResults } from "../src/providers/ocb-sessions.js";
import { withPhotos } from "../src/scoreboard.js";

const fx = JSON.parse(readFileSync(new URL("./fixtures/ocb-f1.json", import.meta.url)));
const F1 = { id: "f1", name: "Formula 1", short: "F1" };
const [spain, future, testing] = fx.events;

test("a grand prix carries its country's flag and the weekend's sessions, practice left out", () => {
  const e = normaliseEvent(fx.events[1], { sport: "formula-1", league: F1 });
  assert.equal(e.flag, "🇦🇿");
  assert.deepEqual(e.sessions.map((s) => [s.kind, s.name, s.start]), [
    ["qualifying", "Qualifying", "2026-09-25T12:00:00.000Z"],
    ["race", "Race", "2026-09-26T11:00:00.000Z"],
  ]);
});

test("completed grand prix with podium, gaps and flags", () => {
  const e = normaliseEvent(spain, { sport: "formula1", league: F1, results: fx.results, nationalities: { Antonelli: "Italian", Verstappen: "Dutch" } });
  assert.equal(e.kind, "race");
  assert.equal(e.status.state, "final");
  assert.equal(e.start, "2026-09-13T13:00:00.000Z");
  assert.equal(e.name, "Spanish Grand Prix");
  assert.equal(e.results.length, 5, "the whole classification, not just the podium");
  assert.deepEqual(e.results.map((r) => r.pos), [1, 2, 3, 4, 5]);
  assert.equal(e.results[0].gap, "1:34:23.754");
  assert.equal(e.results[1].gap, "+4.351s");
  assert.equal(e.results[0].flag, "🇮🇹");
  assert.equal(e.results[2].flag, undefined);
  assert.equal(e.results[0].code, "ANT");
  assert.match(e.results[1].teamColor, /^#/);
});

test("motogp bare displayTime becomes a +gap", () => {
  const rows = [
    { position: "1", lapTime: "41:13.013", displayTime: "0.000", gap: null, status: "INSTND", driver: { firstName: "Marc", lastName: "Marquez" }, team: { shortName: "Ducati" } },
    { position: "2", lapTime: "41:13.670", displayTime: "0.657", gap: null, status: "INSTND", driver: { firstName: "Alex", lastName: "Marquez" }, team: { shortName: "Gresini" } },
    { position: "3", lapTime: "41:15.339", displayTime: "+1 lap", gap: null, status: "INSTND", driver: { firstName: "Pedro", lastName: "Acosta" }, team: { shortName: "KTM" } },
  ];
  const e = normaliseEvent(spain, { sport: "moto-gp", league: { id: "motogp", name: "MotoGP", short: "MotoGP" }, results: rows });
  assert.deepEqual(e.results.map((r) => r.gap), ["41:13.013", "+0.657s", "+1 lap"]);
});

test("scheduled round has no results; live inside the race window", () => {
  const e = normaliseEvent(future, { sport: "formula1", league: F1 });
  assert.equal(e.status.state, "scheduled");
  assert.equal(e.results, undefined);
  const live = normaliseEvent(future, { sport: "formula1", league: F1, now: Date.parse(e.start) + 60e3 });
  assert.equal(live.status.state, "live");
});

test("weeks without a race session are skipped; shouting names are title-cased", () => {
  if (testing) assert.equal(normaliseEvent(testing, { sport: "formula1", league: F1 }), null);
  const loud = { ...spain, name: "GRAND PRIX OF SAN MARINO" };
  assert.equal(normaliseEvent(loud, { sport: "moto-gp", league: { id: "motogp", name: "MotoGP", short: "MotoGP" } }).name, "Grand Prix of San Marino");
});

test("a car that did not finish shows its outcome, not the gap it had", () => {
  const dnf = { position: "NC", status: "DNF", gap: "2 L", displayTime: "DNF", laps: 42, points: "0.0", gridPosition: 20, driver: { firstName: "Carlos", lastName: "Sainz" }, team: { name: "Williams" } };
  const e = normaliseEvent(spain, { sport: "formula1", league: F1, results: [...fx.results, dnf] });
  const last = e.results.at(-1);
  assert.equal(last.pos, undefined);
  assert.equal(last.gap, "DNF");
  assert.equal(last.grid, 20);
  assert.equal(last.points, 0, "zero points is a fact, not a blank");
  assert.equal(last.laps, 42);
});

test("MotoGP's own codes still read as a retirement", () => {
  const out = { position: "NC", status: "OUTSTND", gap: null, displayTime: "0.000", laps: 24, points: "0.0", driver: { firstName: "Jack", lastName: "Miller" }, team: { name: "Pramac" } };
  const odd = { ...out, status: "SOMETHINGNEW" };
  const e = normaliseEvent(spain, { sport: "moto-gp", league: F1, results: [...fx.results, out, odd] });
  assert.deepEqual(e.results.slice(-2).map((r) => r.gap), ["DNF", "DNF"]);
});

test("only the quickest best lap gets the fastest-lap mark", () => {
  const laps = ["1:36.030", "1:36.760", "1:35.587"];
  const rows = fx.results.slice(0, 3).map((r, i) => ({ ...r, id: `r${i}`, bestLapTime: laps[i] }));
  const e = normaliseEvent(spain, { sport: "formula1", league: F1, results: rows });
  assert.deepEqual(e.results.map((r) => r.fastestLap), [undefined, undefined, true]);
});

test("lap times parse with and without minutes", () => {
  assert.equal(lapSeconds("1:35.587"), 95.587);
  assert.equal(lapSeconds("58.214"), 58.214);
  assert.equal(lapSeconds(""), undefined);
  assert.equal(lapSeconds("DNF"), undefined);
});

// Qualifying and sprint, fetched once each is over (real answers, 2026-10-03).
const sx = JSON.parse(readFileSync(new URL("./fixtures/ocb-sessions.json", import.meta.url)));
const AFTER = Date.parse("2026-10-03T12:00:00Z");
/** A fake feed: answers by session id and counts the calls. */
function feed(bySession) {
  const asked = [];
  return { asked, fetch: async (id) => { asked.push(id); return bySession[id] ?? []; } };
}
const idOf = (e, name) => e.schedule.find((s) => s.name === name).id;

test("F1 qualifying: the grid with lap times, fetched once", async () => {
  const e = sx.f1.event;
  const f = feed({ [idOf(e, "Qualifying")]: sx.f1.qualifying });
  const { sessionResults: got, calls } = await sessionResults(e, { fetch: f.fetch, now: AFTER, nationalities: { Verstappen: "Dutch" } });
  assert.equal(calls, 1, "one call: the race is not run yet");
  assert.equal(got.length, 1);
  const q = got[0];
  assert.deepEqual([q.kind, q.name, q.start], ["qualifying", "Qualifying", "2026-10-03T08:00:00.000Z"]);
  assert.deepEqual(q.results.slice(0, 3).map((r) => [r.pos, r.driver, r.time]), [
    [1, "M. Verstappen", "1:35.130"], [2, "L. Hamilton", "1:35.428"], [3, "I. Hadjar", "1:35.558"],
  ]);
  assert.equal(q.results[0].gap, undefined, "pole has no gap");
  assert.equal(q.results[1].gap, "+0.298s");
  assert.equal(q.results[0].flag, "🇳🇱");
  assert.equal(q.results[0].team, "Red Bull Racing");

  const again = await sessionResults(e, { cached: got, fetch: f.fetch, now: AFTER });
  assert.equal(again.calls, 0, "cached: never asked twice");
  assert.deepEqual(again.sessionResults, got);
});

test("MotoGP: the grid is Q2 then the rest of Q1; the sprint is classified like a race", async () => {
  const e = sx.motogp.event;
  const f = feed({
    [idOf(e, "Qualifying 1")]: sx.motogp.q1,
    [idOf(e, "Qualifying 2")]: sx.motogp.q2,
    [idOf(e, "Sprint")]: sx.motogp.sprint,
  });
  const { sessionResults: got, calls } = await sessionResults(e, { fetch: f.fetch, now: AFTER });
  assert.equal(calls, 3);
  assert.deepEqual(got.map((s) => s.kind), ["qualifying", "sprint"]);
  const grid = got[0].results;
  assert.equal(got[0].start, "2026-10-03T02:15:00.000Z", "Q2's start, the session the row is listed with");
  // Q2 had Martin, M. Marquez, Acosta ... Ogura (11), Quartararo (12); Ogura
  // and Fernandez came through Q1, so Q1's own rows start at Bagnaia.
  assert.deepEqual(grid.map((r) => [r.pos, r.driver]), [
    [1, "J. Martin"], [2, "M. Marquez"], [3, "P. Acosta"], [4, "A. Ogura"], [5, "F. Quartararo"],
    [6, "R. Fernandez"], [7, "F. Bagnaia"], [8, "F. Morbidelli"],
  ]);
  assert.equal(grid[0].time, "1:42.371", "the leading zero goes");
  assert.equal(grid[1].gap, "+0.110s");
  const sprint = got[1];
  assert.equal(sprint.name, "Sprint");
  assert.deepEqual(sprint.results.slice(0, 3).map((r) => [r.pos, r.driver, r.gap, r.points]), [
    [1, "M. Marquez", "20:50.376", 12], [2, "D. Moreira", "+2.754s", 9], [3, "J. Martin", "+2.466s", 7],
  ]);
  assert.deepEqual(sprint.results.slice(-2).map((r) => [r.pos, r.gap]), [[undefined, "DNF"], [undefined, "DNF"]]);
});

test("a session still running, or a weekend long done, costs nothing", async () => {
  const e = structuredClone(sx.motogp.event);
  e.schedule.find((s) => s.name === "Qualifying 2").status = "ongoing";
  e.schedule.find((s) => s.name === "Sprint").status = "scheduled";
  const f = feed({});
  assert.deepEqual(await sessionResults(e, { fetch: f.fetch, now: AFTER }), { sessionResults: undefined, calls: 0 });

  const done = structuredClone(sx.f1.event);
  for (const s of done.schedule) s.status = "completed";
  const later = Date.parse("2026-10-10T00:00:00Z");
  const kept = [{ kind: "qualifying", name: "Qualifying", start: "2026-10-03T08:00:00.000Z", results: [{ pos: 1, driver: "M. Verstappen" }] }];
  const r = await sessionResults(done, { cached: kept, fetch: f.fetch, now: later });
  assert.equal(r.calls, 0);
  assert.deepEqual(r.sessionResults, kept, "what was cached stays");
  assert.equal((await sessionResults(done, { fetch: f.fetch, now: later })).calls, 0, "no backfill of past weekends");
});

test("an empty answer is retried until the race starts, a failure too; no budget, no call", async () => {
  const e = sx.f1.event;
  const f = feed({});
  let cached;
  for (let i = 0; i < 5; i += 1) cached = (await sessionResults(e, { cached, fetch: f.fetch, now: AFTER })).sessionResults;
  assert.equal(f.asked.length, 5, "asked every round while the race is ahead");
  assert.equal(cached[0].tries, 5);
  const race = e.schedule.find((x) => x.type === "race");
  const started = Date.parse(race.startTime) + 60e3;
  if (started < Date.parse(race.startTime) + 2 * 86400e3) {
    const before = f.asked.length;
    await sessionResults(e, { cached, fetch: f.fetch, now: started });
    assert.equal(f.asked.length, before, "not once the race is under way");
  }
  // A failing call is an empty answer, not a thrown calendar (review, build 35).
  const broken = await sessionResults(e, { fetch: async () => { throw new Error("HTTP 500"); }, now: AFTER });
  assert.equal(broken.sessionResults[0].tries, 1);
  const g = feed({ [idOf(e, "Qualifying")]: sx.f1.qualifying });
  assert.equal((await sessionResults(e, { fetch: g.fetch, budget: () => false, now: AFTER })).calls, 0);
});

test("the board hands session rows their portraits and keeps the retry count to itself", () => {
  const e = { id: "x", sport: "f1", kind: "race", sessionResults: [
    { kind: "qualifying", name: "Qualifying", start: "2026-10-03T08:00:00.000Z", results: [{ pos: 1, driver: "M. Verstappen", fullName: "Max Verstappen" }] },
    { kind: "sprint", name: "Sprint", start: "2026-10-03T06:00:00.000Z", results: [], tries: 1 },
  ] };
  const out = withPhotos(e, () => "https://img/max.png", (u) => u && `mirror:${u}`);
  assert.equal(out.sessionResults[0].results[0].photo, "mirror:https://img/max.png");
  assert.equal(out.sessionResults[1].tries, undefined);
});
