import test from "node:test";
import assert from "node:assert/strict";
import { tableFromResults, zonesFor } from "../src/tables.js";
import { DIVISIONS } from "../src/divisions.js";

const NOW = Date.parse("2026-09-18T12:00:00Z");
const game = (round, home, away, h, a, over = {}) => ({
  intRound: String(round), strHomeTeam: home, strAwayTeam: away, intHomeScore: String(h), intAwayScore: String(a),
  strStatus: "FT", strTimestamp: "2026-09-10T20:00:00", dateEvent: "2026-09-10", strSeason: "2026-2027",
  strHomeTeamBadge: `https://x/${home}.png`, ...over,
});

test("a cup's league phase becomes one table on points, goal difference, then goals", () => {
  const rows = [
    game(1, "Inter", "Ajax", 2, 0),
    game(1, "Bayern", "Chelsea", 3, 1),
    game(2, "Ajax", "Bayern", 1, 1),
    game(2, "Chelsea", "Inter", 0, 0),
    game(0, "Qualifier FC", "Inter", 5, 0), // the play-off: not the league phase
    game(2, "Qualifier FC", "Ajax", 4, 0, { dateEvent: "2026-08-05" }), // qualifying round 2: numbered like a matchday, played in August
  ];
  const { tables } = tableFromResults(rows, { rounds: [1, 99], after: "09-01", scoring: "points" }, NOW);
  assert.equal(tables.length, 1);
  assert.deepEqual(tables[0].columns, ["p", "w", "d", "l", "gd", "pts"]);
  assert.deepEqual(tables[0].rows.map((r) => [r.pos, r.name, r.value, r.cells.join(" ")]), [
    [1, "Bayern", 4, "2 1 1 0 +2 4"], // level with Inter on points and difference; scored four to two
    [2, "Inter", 4, "2 1 1 0 +2 4"],
    [3, "Ajax", 1, "2 0 1 1 -2 1"], // level with Chelsea on everything: alphabetical, and stable
    [4, "Chelsea", 1, "2 0 1 1 -2 1"],
  ]);
  assert.ok(!tables[0].rows.some((r) => r.name === "Qualifier FC"), "a team that only played in qualifying is not listed");
  assert.equal(tables[0].rows.find((r) => r.name === "Ajax").cells[0], "2", "and Ajax's August qualifier does not count against it");
  assert.equal(tables[0].rows[0].logo, "https://x/Bayern.png", "the crest the feed ships with the game");
});

test("goals scored separate two teams level on points and difference", () => {
  const rows = [game(1, "A", "B", 3, 2), game(1, "C", "D", 1, 0)];
  const { tables } = tableFromResults(rows, { rounds: [1, 8], scoring: "points" }, NOW);
  assert.deepEqual(tables[0].rows.map((r) => r.name), ["A", "C", "B", "D"], "the winners by goals scored, then the losers the same way");
});

test("an NFL season becomes two conference tables, each ranked division by division", () => {
  const rows = [
    game(1, "Buffalo Bills", "Miami Dolphins", 30, 10),
    game(1, "Dallas Cowboys", "Detroit Lions", 20, 24),
    game(2, "Buffalo Bills", "Dallas Cowboys", 7, 7, { strStatus: "AOT" }),
    game(500, "Miami Dolphins", "Buffalo Bills", 40, 0), // preseason
    game(150, "Detroit Lions", "Buffalo Bills", 10, 3), // playoffs
    game(3, "Miami Dolphins", "Detroit Lions", 0, 0, { strStatus: "NS", intHomeScore: null, intAwayScore: null }),
  ];
  const { tables } = tableFromResults(rows, { rounds: [1, 18], scoring: "record", groups: DIVISIONS.nfl }, NOW);
  assert.deepEqual(tables.map((t) => t.id), ["AFC", "NFC"]);
  assert.deepEqual(tables[0].columns, ["w", "l", "t", "pct"]);
  const afc = tables[0].rows;
  assert.deepEqual(afc.map((r) => [r.pos, r.name, r.cells.join(" "), r.section]), [
    [1, "Buffalo Bills", "1 0 1 .750", "East"],
    [2, "Miami Dolphins", "0 1 0 .000", "East"],
  ]);
  // The NFC has one team in the East and one in the North: two divisions in
  // the league's order, each with its own first place.
  const nfc = tables[1].rows;
  assert.deepEqual(nfc.map((r) => [r.pos, r.name, r.cells.join(" "), r.section]), [
    [1, "Dallas Cowboys", "0 1 1 .250", "East"],
    [1, "Detroit Lions", "1 0 0 1.000", "North"],
  ]);
});

test("nothing played is no table, not an empty one", () => {
  const rows = [game(0, "New York Knicks", "Boston Celtics", 0, 0, { strStatus: "NS", intHomeScore: null, intAwayScore: null })];
  assert.equal(tableFromResults(rows, { rounds: [0, 0], scoring: "record", groups: DIVISIONS.nba }, NOW), null);
});

test("every NFL and NBA team has a conference, and only once", () => {
  assert.equal(Object.keys(DIVISIONS.nfl).length, 32);
  assert.equal(Object.keys(DIVISIONS.nba).length, 30);
  assert.equal(new Set(Object.values(DIVISIONS.nfl).map((d) => d.table)).size, 2);
  assert.equal(new Set(Object.values(DIVISIONS.nba).map((d) => d.table)).size, 2);
  assert.deepEqual(DIVISIONS.nfl["Buffalo Bills"], { table: "AFC", division: "East", order: 0 });
  assert.equal(DIVISIONS.nfl["Seattle Seahawks"].order, 3, "West is listed last");
});

test("zones become lines after the places they end at, and a legend that runs to the bottom", () => {
  const zones = [
    { from: 1, to: 4, key: "ucl", line: "solid" },
    { from: 5, to: 5, key: "uel" },
    { from: 18, key: "relegation", line: "dashed" },
  ];
  const { lines, legend } = zonesFor(zones, 20);
  assert.deepEqual(lines, [{ after: 4, line: "solid" }, { after: 17, line: "dashed" }], "a solid line under the fourth, a dashed one above the eighteenth");
  assert.deepEqual(legend, [{ from: 1, to: 4, key: "ucl" }, { from: 5, to: 5, key: "uel" }, { from: 18, to: 20, key: "relegation" }]);
});

test("a cup's league-phase table carries its zones; a conference table with divisions does not", () => {
  const rows = [game(1, "A", "B", 1, 0), game(1, "C", "D", 2, 0)];
  const zones = [{ from: 1, to: 1, key: "r16", line: "solid" }, { from: 2, key: "eliminated" }];
  const cup = tableFromResults(rows, { rounds: [1, 8], scoring: "points", zones }, NOW).tables[0];
  assert.deepEqual(cup.lines, [{ after: 1, line: "solid" }]);
  assert.equal(cup.legend.length, 2);
  const nfl = tableFromResults([game(1, "Buffalo Bills", "Dallas Cowboys", 3, 0)], { rounds: [1, 18], scoring: "record", groups: DIVISIONS.nfl, zones }, NOW).tables[0];
  assert.equal(nfl.lines, undefined, "divisions are their own sections; no cut lines through them");
});
