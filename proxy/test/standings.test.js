import test from "node:test";
import assert from "node:assert/strict";
import { flagIso3 } from "../src/model.js";
import { buildScoreboard } from "../src/scoreboard.js";

test("iso3 flags", () => {
  assert.equal(flagIso3("ita"), "🇮🇹");
  assert.equal(flagIso3("USA"), "🇺🇸");
  assert.equal(flagIso3("xyz"), undefined);
});

test("scoreboard marks leagues that have standings", () => {
  const ev = (id, sport, league) => ({ id, sport, kind: "race", start: "2026-09-13T19:00:00Z", status: { state: "final" }, league });
  const sb = buildScoreboard([ev("a", "f1", { id: "f1", name: "Formula 1", short: "F1" }), ev("b", "nfl", { id: 1, name: "NFL", short: "NFL" })], {
    now: Date.UTC(2026, 8, 13, 20), standings: { "f1:f1": { tables: [] } },
  });
  const by = Object.fromEntries(sb.days.today.map((g) => [g.sport, g.league.hasStandings]));
  assert.deepEqual(by, { f1: true, nfl: false });
});
