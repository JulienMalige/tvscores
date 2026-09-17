import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normaliseEvent, startOf, datesAround, stateOf } from "../src/providers/sportsdb.js";

const events = JSON.parse(readFileSync(new URL("./fixtures/sportsdb-football.json", import.meta.url))).events;
const SERIE_A = { id: 4332, name: "Serie A", short: "SA" };
const find = (name) => events.find((e) => e.strEvent === name);
/** The fixtures were captured on this day; time-dependent rules need it. */
const THEN = Date.parse("2026-09-16T12:00:00Z");

test("a finished match carries its score and reads as final", () => {
  const e = normaliseEvent(find("Inter Milan vs Udinese"), SERIE_A);
  assert.equal(e.status.state, "final");
  assert.deepEqual([e.score.home, e.score.away], [5, 3]);
  assert.equal(e.league.short, "SA");
  assert.equal(e.home.name, "Inter Milan");
  assert.ok(e.home.logo.startsWith("https://"), "and the crest the feed ships with the event");
});

test("a fixture not yet played has no score rather than a zero", () => {
  const e = normaliseEvent(find("Barcelona vs Racing de Santander"), { id: 4335, name: "La Liga", short: "LIGA" }, "football", THEN);
  assert.equal(e.status.state, "scheduled");
  assert.equal(e.score.home, null);
  assert.equal(e.score.away, null);
});

test("kickoff times are read as UTC, not as the server's own zone", () => {
  // `strTimestamp` is UTC but ships without a zone. Parsed naively, every
  // kickoff moves by however many hours the machine happens to be from UTC.
  assert.equal(startOf({ strTimestamp: "2026-09-16T22:30:00" }), "2026-09-16T22:30:00.000Z");
  assert.equal(startOf({ dateEvent: "2026-09-16", strTime: "22:30:00" }), "2026-09-16T22:30:00.000Z");
  assert.equal(startOf({ strTimestamp: "2026-09-16T22:30:00Z" }), "2026-09-16T22:30:00.000Z");
  assert.equal(startOf({}), null, "and an event with no time at all is dropped, not dated today");
});

test("0-0 is a score; an empty string is not", () => {
  const drawn = { ...find("Torino vs Roma"), intHomeScore: "0", intAwayScore: 0 };
  const e = normaliseEvent(drawn, SERIE_A);
  assert.deepEqual([e.score.home, e.score.away], [0, 0]);
  const blank = normaliseEvent({ ...drawn, intHomeScore: "", intAwayScore: null }, SERIE_A);
  assert.deepEqual([blank.score.home, blank.score.away], [null, null]);
});

test("a match in play shows the minute, and the interval does not", () => {
  const raw = { ...find("Torino vs Roma"), strStatus: "2H", strProgress: "67" };
  assert.equal(normaliseEvent(raw, SERIE_A).status.clock, "67'");
  const ht = normaliseEvent({ ...raw, strStatus: "HT" }, SERIE_A);
  assert.equal(ht.status.clock, undefined);
  assert.equal(ht.status.detail, "Half-time");
  assert.equal(ht.status.state, "live");
});

test("a postponed match is neither scheduled nor final", () => {
  const e = normaliseEvent({ ...find("Botafogo vs Grêmio"), strPostponed: "yes" }, SERIE_A, "football", THEN);
  assert.equal(e.status.state, "other");
  assert.equal(e.status.detail, "Postponed");
});

test("the window is yesterday plus the seven days Upcoming shows", () => {
  const days = datesAround({ back: 1, ahead: 7 }, new Date("2026-09-15T12:00:00Z"));
  assert.equal(days.length, 9);
  assert.equal(days[0], "2026-09-14");
  assert.equal(days.at(-1), "2026-09-22");
});

const US = JSON.parse(readFileSync(new URL("./fixtures/sportsdb-us.json", import.meta.url))).events;
const NFL = { id: 4391, name: "NFL", short: "NFL" };
const NBA = { id: 4387, name: "NBA", short: "NBA" };

test("American teams are known by their nickname", () => {
  const e = normaliseEvent(US.find((x) => x.strLeague === "NFL"), NFL, "nfl");
  assert.equal(e.sport, "nfl");
  assert.equal(e.id.startsWith("nfl:tsdb:"), true, "and ids are namespaced per sport");
  assert.equal(e.home.nick, "Giants", "which is the label the row shows");
  assert.equal(e.home.name, "New York Giants", "with the full name kept alongside");
  assert.equal(e.away.nick, "Cowboys");
  assert.equal(e.status.state, "final");
  assert.deepEqual([e.score.home, e.score.away], [28, 20]);
});

test("a quarter reads as a quarter, a football minute as a minute", () => {
  const nfl = US.find((x) => x.strLeague === "NFL");
  assert.equal(normaliseEvent({ ...nfl, strStatus: "Q3", strProgress: "2:37" }, NFL, "nfl").status.clock, "3rd 2:37");
  assert.equal(normaliseEvent({ ...nfl, strStatus: "OT", strProgress: "1:12" }, NFL, "nfl").status.clock, "OT 1:12");
  const soccer = events.find((e) => e.strEvent === "Torino vs Roma");
  assert.equal(normaliseEvent({ ...soccer, strStatus: "2H", strProgress: "67" }, SERIE_A).status.clock, "67'");
});

test("an ending we have never seen reads as live, not as scheduled", () => {
  // The status vocabularies differ per sport and are not documented in full.
  // A game showing an unknown label is being played; calling it "scheduled"
  // would put a match in progress under tomorrow's fixtures.
  const nba = US.find((x) => x.strLeague === "NBA");
  assert.equal(stateOf({ ...nba, strStatus: "Q4" }), "live");
  assert.equal(stateOf({ ...nba, strStatus: "SOMETHING-NEW" }), "live");
  assert.equal(stateOf({ ...nba, strStatus: "NS" }), "scheduled");
  assert.equal(stateOf({ ...nba, strStatus: "FT" }), "final");
  assert.equal(stateOf({ ...nba, strStatus: "PPD" }), "other");
});

test("a competition with no table is skipped, not fatal", async () => {
  // A knockout cup and an out-of-season league both answer with an empty body.
  // Before, that threw inside JSON.parse and took the whole pass with it.
  const { sportsDbSport } = await import("../src/providers/sportsdb.js");
  const provider = sportsDbSport({
    sport: "football",
    key: "test",
    leagues: [{ id: 1, name: "A league", short: "A" }],
    window: { back: 1, ahead: 7 },
    quota: { record() {} },
    seasons: { 1: "2026-2027" },
  });
  assert.equal(typeof provider.standings, "function");
});

test("a fixture still 'not started' hours after kickoff is not shown as upcoming", () => {
  // The provider never updated Botafogo v Grêmio. Showing its kickoff time
  // four hours later says the match is still to come; it plainly is not.
  const row = events.find((e) => e.strEvent === "Botafogo vs Grêmio");
  const kickoff = Date.parse("2026-09-16T22:30:00Z");
  assert.equal(stateOf(row, kickoff + 60 * 60e3), "scheduled", "an hour late is a late kickoff");
  assert.equal(stateOf(row, kickoff + 4 * 3600e3), "other", "four hours late is a provider that stopped");
  const e = normaliseEvent(row, { id: 4351, name: "Brasileirão", short: "BRA" }, "football", kickoff + 4 * 3600e3);
  assert.equal(e.status.detail, "No update", "and it says why it stopped");
  assert.equal(e.score.home, null, "without inventing a score");
});
