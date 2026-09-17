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

// ---- when a table is asked for again: the rule both schedulers share ----
import { refreshStandings } from "../src/standings.js";

const H = 3600e3;
const NOW = Date.parse("2026-09-16T18:00:00Z");
const TABLE = { updatedAt: "x", tables: [{ id: "table", rows: [{ pos: 1, name: "A" }] }] };

/** A scheduler as refreshStandings sees it: a provider, its meta, a store. */
function subject({ standings, lastStandings, standingsEmpty, dirty, spendable = 50 } = {}) {
  const asked = [];
  const saved = [];
  return {
    asked, saved,
    p: { sport: "football", standings: standings && (async (only) => (asked.push(only ?? "all"), standings)) },
    meta: { lastStandings: lastStandings ? new Date(lastStandings).toISOString() : undefined, standingsEmpty },
    store: { setStandings: (s, l, d) => saved.push(`${s}:${l}`), touch() {} },
    dirtyLeagues: new Set(dirty || []),
    quota: { spendable: () => spendable },
    log() {},
  };
}

test("a table is asked for every six hours, and not before", async () => {
  const s = subject({ standings: { 4335: TABLE }, lastStandings: NOW - 5 * H });
  await refreshStandings(s, NOW);
  assert.deepEqual(s.asked, [], "five hours is too soon");
  await refreshStandings(s, NOW + H);
  assert.deepEqual(s.asked, ["all"]);
  assert.deepEqual(s.saved, ["football:4335"]);
  assert.equal(s.meta.lastStandings, new Date(NOW + H).toISOString());
});

test("a final whistle brings the next look forward to ten minutes, for that league only", async () => {
  const s = subject({ standings: { 4335: TABLE }, lastStandings: NOW - 30 * 60e3, dirty: ["4335"] });
  await refreshStandings(s, NOW);
  assert.equal(s.asked.length, 1);
  assert.deepEqual([...s.asked[0]], ["4335"], "only the league whose table moved");
  assert.equal(s.dirtyLeagues.size, 0, "and it is no longer owed a look");
});

test("a whistle five minutes after the last look waits the ten minutes", async () => {
  const s = subject({ standings: { 4335: TABLE }, lastStandings: NOW - 5 * 60e3, dirty: ["4335"] });
  await refreshStandings(s, NOW);
  assert.deepEqual(s.asked, []);
  assert.equal(s.dirtyLeagues.size, 1, "still owed");
});

test("a look that found no table at all is repeated in half an hour, not six hours", async () => {
  const s = subject({ standings: {}, lastStandings: NOW - 7 * H });
  await refreshStandings(s, NOW);
  assert.equal(s.meta.standingsEmpty, true);
  assert.deepEqual(s.saved, [], "nothing to store");
  await refreshStandings(s, NOW + 29 * 60e3);
  assert.equal(s.asked.length, 1, "not yet");
  await refreshStandings(s, NOW + 31 * 60e3);
  assert.equal(s.asked.length, 2, "half an hour on, it is asked again");
});

test("the table is not bought with the last of the day's quota", async () => {
  const s = subject({ standings: { 4335: TABLE }, lastStandings: 0, spendable: 1 });
  await refreshStandings(s, NOW);
  assert.deepEqual(s.asked, [], "one call left is kept for the scores");
});

test("a calendar sport's single table is kept under its own name, and an empty one changes nothing", async () => {
  const one = subject({ standings: TABLE, lastStandings: 0 });
  await refreshStandings(one, NOW);
  assert.deepEqual(one.saved, ["football:football"]);
  const blank = subject({ standings: { tables: [{ id: "drivers", rows: [] }] }, lastStandings: 0 });
  await refreshStandings(blank, NOW);
  assert.deepEqual(blank.saved, [], "an empty classification does not replace the one people can see");
  assert.equal(blank.meta.lastStandings, undefined, "and the clock is not stamped, so it is tried again next tick");
});

test("a provider with no tables is simply not asked", async () => {
  const s = subject({ lastStandings: 0 });
  await refreshStandings(s, NOW);
  assert.deepEqual(s.asked, []);
});
