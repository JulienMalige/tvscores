import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normaliseEvent, startOf, datesAround } from "../src/providers/sportsdb.js";

const events = JSON.parse(readFileSync(new URL("./fixtures/sportsdb-football.json", import.meta.url))).events;
const SERIE_A = { id: 4332, name: "Serie A", short: "SA" };
const find = (name) => events.find((e) => e.strEvent === name);

test("a finished match carries its score and reads as final", () => {
  const e = normaliseEvent(find("Inter Milan vs Udinese"), SERIE_A);
  assert.equal(e.status.state, "final");
  assert.deepEqual([e.score.home, e.score.away], [5, 3]);
  assert.equal(e.league.short, "SA");
  assert.equal(e.home.name, "Inter Milan");
  assert.ok(e.home.logo.startsWith("https://"), "and the crest the feed ships with the event");
});

test("a fixture not yet played has no score rather than a zero", () => {
  const e = normaliseEvent(find("Barcelona vs Racing de Santander"), { id: 4335, name: "La Liga", short: "LIGA" });
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
  const e = normaliseEvent({ ...find("Botafogo vs Grêmio"), strPostponed: "yes" }, SERIE_A);
  assert.equal(e.status.state, "other");
  assert.equal(e.status.detail, "Postponed");
});

test("the window is yesterday plus the seven days Upcoming shows", () => {
  const days = datesAround({ back: 1, ahead: 7 }, new Date("2026-09-15T12:00:00Z"));
  assert.equal(days.length, 9);
  assert.equal(days[0], "2026-09-14");
  assert.equal(days.at(-1), "2026-09-22");
});
