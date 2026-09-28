import test from "node:test";
import assert from "node:assert/strict";
import { parsePeriods, normaliseStats, normaliseTimeline, recordOf, EventDetails } from "../src/details.js";

test("the NBA's quarters come as two lists", () => {
  const p = parsePeriods(" San Antonio Spurs Quarters:<br>23 19 30 18 <br><br>New York Knicks Quarters:<br>13 24 28 29 ");
  assert.deepEqual(p, { labels: ["1", "2", "3", "4"], home: [23, 19, 30, 18], away: [13, 24, 28, 29] });
});

test("the NFL's quarters come as home-away pairs, and an empty overtime is no period", () => {
  const p = parsePeriods(" Denver Broncos Quarter 1:<br>0 7 <br>Quarter 2<br>0 9 <br>Quarter 3<br>16 0 <br>Quarter 4<br>14 10 <br>Overtime<br> ");
  assert.deepEqual(p, { labels: ["1", "2", "3", "4"], home: [0, 0, 16, 14], away: [7, 9, 0, 10] });
  const ot = parsePeriods("X Quarter 1:<br>3 0 <br>Quarter 2<br>0 3 <br>Quarter 3<br>0 0 <br>Quarter 4<br>7 7 <br>Overtime<br>3 0 ");
  assert.deepEqual(ot.labels, ["1", "2", "3", "4", "OT"]);
  assert.equal(parsePeriods(""), undefined);
});

test("statistics are trimmed to the page's set, in its order", () => {
  const rows = [
    { strStat: "Total Shots", intHome: "12", intAway: "9" },
    { strStat: "Ball Possession", intHome: "58%", intAway: "42%" },
    { strStat: "Shots outsidebox", intHome: "4", intAway: "3" },
  ];
  assert.deepEqual(normaliseStats("football", rows), [{ id: "possession", home: 58, away: 42 }, { id: "shots", home: 12, away: 9 }]);
  assert.deepEqual(normaliseStats("nfl", rows), [], "the NFL has none");
});

test("goals and cards in minute order, substitutions left out", () => {
  const t = normaliseTimeline([
    { strTimeline: "Goal", strTimelineDetail: "Own Goal", strHome: "Yes", intTime: "63", strPlayer: "Martínez" },
    { strTimeline: "Card", strTimelineDetail: "Yellow Card", strHome: "No", intTime: "45", strPlayer: "King" },
    { strTimeline: "subst", strTimelineDetail: "Substitution 1", strHome: "Yes", intTime: "71" },
    { strTimeline: "Goal", strTimelineDetail: "Penalty", strHome: "No", intTime: "80", strPlayer: "Fernandes" },
  ]);
  assert.deepEqual(t.map((m) => [m.minute, m.side, m.kind]), [[45, "away", "yellow"], [63, "home", "ownGoal"], [80, "away", "penalty"]]);
});

test("a record reads the table's own columns", () => {
  assert.equal(recordOf({ columns: ["p", "w", "d", "l", "gd", "pts"] }, { cells: ["5", "3", "1", "1", "+4", "10"] }), "3-1-1");
  assert.equal(recordOf({ columns: ["w", "l", "t", "pct"] }, { cells: ["2", "1", "0", ".667"] }), "2-1");
  assert.equal(recordOf({ columns: ["w", "l", "t", "pct"] }, { cells: ["2", "1", "1", ".625"] }), "2-1-1");
  assert.equal(recordOf({ columns: ["pts"] }, { cells: ["3"] }), undefined);
});

test("a game's page is fetched on demand and held while it cannot change", async () => {
  const event = { id: "nfl:tsdb:1", sport: "nfl", league: { id: 4391 }, status: { state: "final" }, home: { name: "A" }, away: { name: "B" } };
  const store = {
    events: new Map([[event.id, event]]),
    standings: { "nfl:4391": { tables: [{ columns: ["w", "l", "t", "pct"], rows: [{ name: "A", cells: ["2", "0", "0", "1.000"] }, { name: "B", cells: ["1", "1", "0", ".500"] }] }] } },
  };
  let calls = 0;
  const fetch = async (url) => {
    calls += 1;
    if (url.includes("lookupevent.php")) return { body: { events: [{ strVenue: "Field", strResult: "A Quarter 1:<br>7 0 <br>Quarter 2<br>0 3 " }] } };
    return { body: {} };
  };
  let clock = 0;
  const details = new EventDetails({ key: "k", store, fetch, now: () => clock });
  const body = await details.get("nfl:tsdb:1");
  assert.equal(body.venue, "Field");
  assert.deepEqual(body.periods.home, [7, 0]);
  assert.deepEqual(body.records, { home: "2-0", away: "1-1" });
  const first = calls;
  clock = 3600e3;
  await details.get("nfl:tsdb:1");
  assert.equal(calls, first, "a finished game is not fetched again within the hour");
  assert.equal(await details.get("nfl:tsdb:999"), undefined, "a game we do not hold");
});
