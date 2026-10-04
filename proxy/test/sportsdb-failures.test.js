import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sportsDbSport } from "../src/providers/sportsdb.js";

const football = JSON.parse(readFileSync(new URL("./fixtures/sportsdb-football.json", import.meta.url))).events;
const SERIE_A = { id: 4332, name: "Serie A", short: "SA" };
const LA_LIGA = { id: 4335, name: "La Liga", short: "LIGA" };

/** The network: a route answers with a body, or with a status when it is a number. */
function network(t, routes) {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    calls.push(url);
    const hit = Object.entries(routes).find(([frag]) => url.includes(frag));
    if (!hit) throw new Error(`unexpected request ${url}`);
    const answer = typeof hit[1] === "function" ? hit[1](url, calls) : hit[1];
    if (typeof answer === "number") return new Response("", { status: answer });
    return new Response(answer == null ? "" : JSON.stringify(answer), { status: 200 });
  });
  return calls;
}

function provider(over = {}) {
  const spent = { calls: 0 };
  const logged = [];
  const p = sportsDbSport({
    sport: "football", key: "k", leagues: [SERIE_A, LA_LIGA], window: { back: 1, ahead: 7 },
    quota: { record: () => spent.calls++ }, seasons: {}, log: (m) => logged.push(m), ...over,
  });
  return { p, spent, logged };
}

test("a date that fails costs that date, not the week", async (t) => {
  network(t, {
    "d=2026-10-03": 500,
    "eventsday.php": { events: football },
    "eventsnextleague.php": null,
  });
  const { p, logged } = provider();
  const realNow = Date.now;
  Date.now = () => Date.parse("2026-10-03T12:00:00Z"); // so the window holds the failing date
  try {
    const rows = await p.daily();
    assert.ok(rows.length > 0, "the other days' fixtures came");
    assert.equal(rows.partial, true, "marked unfinished, so the scheduler asks again soon");
    assert.ok(logged.some((m) => m.includes("2026-10-03")), "and the date that failed is named");
  } finally {
    Date.now = realNow;
  }
});

test("a week in which nothing came is an error", async (t) => {
  network(t, { "eventsday.php": 500 });
  const { p } = provider();
  await assert.rejects(() => p.daily(), /HTTP 500/);
});

test("one competition's next-fixture lookup failing leaves the others, and its own answer as it was", async (t) => {
  network(t, {
    "eventsday.php": { events: [] },
    "eventsnextleague.php?id=4332": 500,
    "eventsnextleague.php?id=4335": { events: [{ strTimestamp: "2026-10-04T14:00:00", strSeason: "2026-2027" }] },
  });
  const next = { 4332: { start: "2026-12-01T00:00:00.000Z" } };
  const { p } = provider({ next });
  await p.daily();
  assert.equal(next[4332].start, "2026-12-01T00:00:00.000Z", "what we knew of Serie A stays");
  assert.ok(next[4335], "and La Liga's is read");
});

test("a fixture with a team still to be decided is skipped, and does not take the day with it", async (t) => {
  const placeholder = { ...football.find((r) => String(r.idLeague) === "4332"), idEvent: "999", strHomeTeam: null };
  network(t, { "eventsday.php": { events: [placeholder, ...football] } });
  const { p } = provider();
  const rows = await p.byDate("2026-09-16");
  assert.ok(rows.length > 0, "the rest of the day is there");
  assert.ok(!rows.some((e) => e.id.endsWith(":999")), "and the placeholder is not");
});

test("a call that is refused is still a call spent", async (t) => {
  network(t, { "eventsday.php": 429 });
  const { p, spent } = provider();
  await assert.rejects(() => p.byDate("2026-09-16"));
  assert.equal(spent.calls, 1, "the 429 counted against the day");
});

test("one league's table failing leaves the others' tables", async (t) => {
  network(t, {
    "lookuptable.php?l=4332": 500,
    "lookuptable.php?l=4335": { table: [{ intRank: "1", strTeam: "A", intPlayed: "1", intWin: "1", intDraw: "0", intLoss: "0", intGoalsFor: "1", intGoalsAgainst: "0", intGoalDifference: "1", intPoints: "3" }] },
  });
  const { p } = provider({ seasons: { 4332: "2026-2027", 4335: "2026-2027" } });
  const out = await p.standings();
  assert.ok(out[4335], "La Liga's table came");
  assert.equal(out[4332], undefined, "Serie A's did not, and the call did not throw");
});

test("every table failing is an error, so the scheduler backs off", async (t) => {
  network(t, { "lookuptable.php": 500 });
  const { p } = provider({ seasons: { 4332: "2026-2027", 4335: "2026-2027" } });
  await assert.rejects(() => p.standings(), /HTTP 500/);
});
