import test from "node:test";
import assert from "node:assert/strict";
import { CalendarScheduler } from "../src/calendar-scheduler.js";
import { tmpStore } from "./helpers/schedule.js";

test("a classification that came back empty is asked for again half an hour later, for a day", () => {
  const store = tmpStore();
  const race = { id: "f1:late", sport: "f1", kind: "race", start: "2026-10-04T07:00:00Z", status: { state: "final" }, league: { id: "f1" }, results: [], resultsFetchedAt: "2026-10-04T10:36:00Z" };
  store.upsert([race]);
  assert.equal(store.hasResults("f1:late", Date.parse("2026-10-04T10:50:00Z")), true, "fourteen minutes after the empty answer: wait");
  assert.equal(store.hasResults("f1:late", Date.parse("2026-10-04T11:10:00Z")), false, "half an hour on: ask again");
  assert.equal(store.hasResults("f1:late", Date.parse("2026-10-05T04:00:00Z")), false, "twenty-one hours after the race: still asking");
  assert.equal(store.hasResults("f1:late", Date.parse("2026-10-05T09:00:00Z")), true, "a day and two hours after it: let go");
});

test("the motorsport calendar looks every half hour at a race that is over and has no podium", () => {
  const store = tmpStore();
  const race = { id: "f1:late", sport: "f1", kind: "race", start: "2026-10-04T07:00:00Z", status: { state: "final" }, league: { id: "f1" }, results: [] };
  store.upsert([race]);
  const s = new CalendarScheduler({ provider: { sport: "f1" }, store, log: () => {}, quota: null });
  const evening = Date.parse("2026-10-04T14:00:00Z");
  assert.equal(s.nextDelay(evening), 30 * 60e3, "seven hours after the flag, with nothing classified");
  store.upsert([{ ...race, results: [{ fullName: "A" }] }]);
  assert.equal(s.nextDelay(evening), 6 * 3600e3, "with the podium in, the calendar goes back to six hours");
});
