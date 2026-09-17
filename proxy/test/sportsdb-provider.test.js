import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sportsDbSport } from "../src/providers/sportsdb.js";

const football = JSON.parse(readFileSync(new URL("./fixtures/sportsdb-football.json", import.meta.url))).events;
const SERIE_A = { id: 4332, name: "Serie A", short: "SA" };
const LA_LIGA = { id: 4335, name: "La Liga", short: "LIGA" };

/**
 * The network, answered from a table of URL fragments. An entry that is a
 * function is called with the URL; `null` is the provider's empty 200; a
 * fragment nobody listed is a test bug, not a silent miss.
 */
function network(t, routes) {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url, headers: init?.headers || {} });
    const hit = Object.entries(routes).find(([frag]) => url.includes(frag));
    if (!hit) throw new Error(`unexpected request ${url}`);
    const body = typeof hit[1] === "function" ? hit[1](url) : hit[1];
    return new Response(body == null ? "" : JSON.stringify(body), { status: 200 });
  });
  return calls;
}

const provider = (over = {}) => {
  const spent = { calls: 0 };
  const seasons = over.seasons ?? {};
  const p = sportsDbSport({
    sport: "football",
    key: "k",
    leagues: [SERIE_A, LA_LIGA],
    window: { back: 1, ahead: 7 },
    quota: { record: () => spent.calls++ },
    seasons,
    log: () => {},
    ...over,
  });
  return { p, spent, seasons };
};

test("a day's fixtures are filtered to our competitions, and every call is charged", async (t) => {
  const calls = network(t, { "eventsday.php": { events: football } });
  const { p, spent, seasons } = provider();
  const ours = await p.byDate("2026-09-16");
  assert.ok(ours.length > 0);
  assert.ok(ours.every((e) => [4332, 4335].includes(e.league.id)), "nothing from a league we do not follow");
  assert.ok(football.some((r) => ![4332, 4335].includes(Number(r.idLeague))), "and the fixture did hold others");
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /d=2026-09-16&s=Soccer/);
  assert.equal(spent.calls, 1, "one request, one unit of quota");
  const named = football.find((r) => String(r.idLeague) === "4332").strSeason;
  assert.ok(named, "the fixture names a season");
  assert.equal(seasons["4332"], named, "and the provider keeps it, so the table lookup will not have to ask");
});

test("the daily pass is one call per day of the window, which is what it says it costs", async (t) => {
  const calls = network(t, { "eventsday.php": { events: [] } });
  const { p } = provider();
  await p.daily();
  assert.equal(calls.length, 9, "yesterday, today and seven days ahead");
  assert.equal(p.dailyCost, 9, "and the scheduler is told the same number");
  const dates = calls.map((c) => c.url.match(/d=(\d{4}-\d{2}-\d{2})/)[1]);
  assert.deepEqual([...new Set(dates)].length, 9, "nine different dates");
});

test("the live feed is the V2 endpoint with the key in a header, never in the URL", async (t) => {
  const inPlay = { ...football.find((r) => r.strEvent === "Torino vs Roma"), strStatus: "2H", strProgress: "70" };
  const calls = network(t, { "/v2/json/livescore/soccer": { livescore: [inPlay, { ...inPlay, idEvent: "x", idLeague: "9999" }] } });
  const { p } = provider();
  const rows = await p.live();
  assert.equal(rows.length, 1, "the foreign league is dropped here too");
  assert.equal(rows[0].status.state, "live");
  assert.equal(calls[0].headers["X-API-KEY"], "k");
  assert.ok(!calls[0].url.includes("/k/"), "the V1 key-in-path shape is not used for V2");
});

test("without a key the provider refuses rather than asking with the public one", async () => {
  const { p } = provider({ key: "" });
  await assert.rejects(p.byDate("2026-09-16"), /key missing/);
  await assert.rejects(p.live(), /key missing/);
  await assert.rejects(p.standings(), /key missing/);
});

test("a league table becomes rows with a record under each team", async (t) => {
  network(t, {
    "lookuptable.php?l=4332": { table: [
      { intRank: "1", strTeam: "Inter", intPlayed: "3", intWin: "3", intDraw: "0", intLoss: "0", intPoints: "9", strBadge: "https://x/inter.png" },
      { intRank: "2", strTeam: "Roma", intPlayed: "3", intWin: "2", intDraw: "1", intLoss: "0", intPoints: "7" },
    ] },
    "lookuptable.php?l=4335": null,
  });
  const { p } = provider({ seasons: { 4332: "2025-2026", 4335: "2025-2026" } });
  const tables = await p.standings();
  assert.deepEqual(Object.keys(tables), ["4332"], "the league whose table came back empty is left out, not shown blank");
  const [inter, roma] = tables[4332].tables[0].rows;
  assert.deepEqual(inter, { pos: 1, name: "Inter", sub: "3 · 3-0-0", value: 9, logo: "https://x/inter.png" });
  assert.equal(roma.logo, undefined);
  assert.equal(roma.sub, "3 · 2-1-0");
});

test("a competition with no table is skipped, not fatal", async (t) => {
  // A knockout cup and an out-of-season league both answer with an empty body.
  // Before, that threw inside JSON.parse and took the whole pass with it.
  network(t, { "lookuptable.php": null });
  const { p } = provider({ seasons: { 4332: "2025-2026", 4335: "2025-2026" } });
  assert.deepEqual(await p.standings(), {});
});

test("after a final whistle only that league's table is asked for", async (t) => {
  const calls = network(t, { "lookuptable.php": { table: [{ intRank: "1", strTeam: "A", intPoints: "3" }] } });
  const { p } = provider({ seasons: { 4332: "2025-2026", 4335: "2025-2026" } });
  const tables = await p.standings(new Set(["4335"]));
  assert.deepEqual(Object.keys(tables), ["4335"]);
  assert.equal(calls.length, 1, "one league, one call");
  assert.match(calls[0].url, /l=4335&s=2025-2026/);
});

test("a season nobody has told us yet is looked up once and then remembered", async (t) => {
  const calls = network(t, {
    "lookupleague.php?id=4332": { leagues: [{ strCurrentSeason: "2025-2026" }] },
    "lookupleague.php?id=4335": { leagues: [{}] },
    "lookuptable.php": { table: [{ intRank: "1", strTeam: "A", intPoints: "3" }] },
  });
  const { p, seasons } = provider();
  const first = await p.standings();
  assert.deepEqual(Object.keys(first), ["4332"], "a league whose season is unknown has no table to ask for");
  assert.equal(seasons["4332"], "2025-2026");
  const lookups = () => calls.filter((c) => c.url.includes("lookupleague")).length;
  assert.equal(lookups(), 2);
  await p.standings();
  assert.equal(lookups(), 3, "Serie A's season is kept; only the league that answered nothing is asked again");
});
