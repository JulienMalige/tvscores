import test from "node:test";
import assert from "node:assert/strict";
import { buildScoreboard, localDate } from "../src/scoreboard.js";

const ev = (id, start, sport = "football", state = "scheduled") => ({
  id, sport, kind: "match", start, status: { state }, league: { id: 2, name: "UCL", short: "UCL" },
});

test("buckets follow the viewer's time zone", () => {
  const now = Date.UTC(2026, 8, 13, 21, 30); // 23:30 Paris
  const events = [
    ev("a", "2026-09-13T23:30:00Z"), // 01:30 Paris on the 14th -> upcoming in Paris, today in UTC
    ev("b", "2026-09-13T19:00:00Z", "football", "live"),
    ev("c", "2026-09-12T19:00:00Z", "football", "final"),
    ev("e", "2026-09-13T20:25:00Z", "nfl", "live"), // started "yesterday" in Paris but still live -> today
    ev("d", "2026-09-20T13:00:00Z", "f1"),
  ];
  const paris = buildScoreboard(events, { tz: "Europe/Paris", now, sportOrder: ["football", "f1", "nfl"] });
  assert.deepEqual(paris.days.today.flatMap((g) => g.events.map((e) => e.id)), ["b", "e"]);
  assert.deepEqual(paris.days.yesterday.flatMap((g) => g.events.map((e) => e.id)), ["c"]);
  assert.deepEqual(paris.days.upcoming.flatMap((g) => g.events.map((e) => e.id)), ["a", "d"]);
  assert.equal(paris.live, 2);
  const utc = buildScoreboard(events, { tz: "UTC", now, sportOrder: ["football", "f1", "nfl"] });
  assert.deepEqual(utc.days.today.flatMap((g) => g.events.map((e) => e.id)), ["b", "a", "e"]);
});

test("stale is per sport", () => {
  const now = Date.UTC(2026, 8, 13, 12);
  const meta = { football: { lastOk: new Date(now - 3600e3).toISOString() }, nfl: { lastOk: new Date(now - 10 * 3600e3).toISOString() }, nba: {} };
  const sb = buildScoreboard([], { now, meta });
  assert.deepEqual(sb.stale, { football: false, nfl: true, nba: true });
});

test("localDate", () => {
  assert.equal(localDate("2026-09-13T23:30:00Z", "Europe/Paris"), "2026-09-14");
  assert.equal(localDate("2026-09-13T23:30:00Z", "America/New_York"), "2026-09-13");
});
