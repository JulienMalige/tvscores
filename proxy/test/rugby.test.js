import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { config } from "../src/config.js";
import { STATE } from "../src/model.js";
import { normaliseEvent, rugbyName } from "../src/providers/sportsdb-events.js";
import { sportsDbSport } from "../src/providers/sportsdb.js";
import { gameFor, resultOf, rugbyProvider, statusOf, withResult } from "../src/providers/rugby.js";

// The weekend of 7 and 8 November 2026 as both feeds had it on the Sunday
// night, our competitions and one other each day: TheSportsDB still had
// England v Australia "not started" seven hours after kickoff, La Rochelle v
// Bayonne at "1H 12-8" after the final whistle, and France 34-21 Fiji for the
// 54-17 that API-Sports and ESPN agree on.
const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url)));
const TSDB = { "2026-11-07": fixture("rugby-tsdb-2026-11-07").events, "2026-11-08": fixture("rugby-tsdb-2026-11-08").events };
const API = { "2026-11-07": fixture("rugby-apisports-2026-11-07"), "2026-11-08": fixture("rugby-apisports-2026-11-08") };
const LEAGUES = config.leagues.rugby;
const SUNDAY_NIGHT = Date.parse("2026-11-08T22:00:00Z");

/** Our fixtures of one day, as the TheSportsDB half of the provider gives them. */
const ours = (date) => TSDB[date]
  .filter((r) => LEAGUES.some((l) => String(l.id) === r.idLeague))
  .map((r) => normaliseEvent(r, LEAGUES.find((l) => String(l.id) === r.idLeague), "rugby", SUNDAY_NIGHT));
const named = (events, home) => events.find((e) => e.home.name === home);

/** The network, from URL fragments; anything unlisted is a test bug. */
function network(t, routes) {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url, headers: init?.headers || {} });
    const hit = Object.entries(routes).find(([frag]) => url.includes(frag));
    if (!hit) throw new Error(`unexpected request ${url}`);
    return new Response(JSON.stringify(hit[1]), { status: 200, headers: { "x-ratelimit-requests-remaining": "90" } });
  });
  return calls;
}

function provider({ now = SUNDAY_NIGHT, meta = {}, key = "k", spendable = 50 } = {}) {
  const spent = { api: 0, tsdb: 0 };
  const fixtures = sportsDbSport({ sport: "rugby", key: "tsdb", leagues: LEAGUES, window: { back: 1, ahead: 7 }, quota: { record: () => spent.tsdb++ } });
  const quota = { record: () => spent.api++, spendable: () => spendable };
  return { p: rugbyProvider({ fixtures, leagues: LEAGUES, key, quota, meta, now: () => now }), spent, meta };
}

test("a rugby side is said without the word the feed tells it from a football one by", () => {
  const sat = ours("2026-11-07");
  assert.deepEqual([named(sat, "France").away.name, named(sat, "Italy").away.name], ["Fiji", "South Africa"]);
  assert.ok(named(sat, "Montpellier Hérault"), "a club with the word in its own name loses it as well");
  assert.equal(named(sat, "Castres Olympique").away.name, "Racing 92", "and Racing 92 has its name since 2015");
  assert.equal(rugbyName("Stade Toulousain"), "Stade Toulousain");
  assert.equal(rugbyName("Rugby Club Vannes"), "Rugby Club Vannes", "only the last word");
});

test("API-Sports' statuses read as ours, and an unknown one after kickoff as play", () => {
  const read = (short) => statusOf({ status: { short } });
  assert.deepEqual(read("FT"), { state: STATE.final, detail: undefined });
  assert.deepEqual(read("AET"), { state: STATE.final, detail: "After extra time" });
  assert.deepEqual(read("AW"), { state: STATE.final, detail: "Awarded" });
  assert.deepEqual(read("NS"), { state: STATE.scheduled });
  assert.deepEqual(read(""), { state: STATE.scheduled });
  assert.deepEqual(read("1H"), { state: STATE.live, detail: undefined });
  assert.deepEqual(read("HT"), { state: STATE.live, detail: "Half-time" });
  assert.deepEqual(read("ET"), { state: STATE.live, detail: "Extra time" });
  assert.deepEqual(read("INTR"), { state: STATE.live, note: "Interrupted" });
  assert.deepEqual(read("POST"), { state: STATE.other, detail: "Postponed" });
  assert.deepEqual(read("CANC"), { state: STATE.other, detail: "Cancelled" });
  assert.deepEqual(read("3H"), { state: STATE.live, detail: undefined });
  assert.deepEqual(read("constructor"), { state: STATE.live, detail: undefined }, "a status is a key of ours, not of every object");
});

test("every game of the weekend is found in the other feed, and its score with it", () => {
  for (const date of ["2026-11-07", "2026-11-08"]) {
    const games = API[date].response;
    const events = ours(date);
    assert.ok(games.some((g) => !LEAGUES.some((l) => l.apiSports === g.league.id)), "the day did hold others");
    for (const e of events) {
      const apiLeague = LEAGUES.find((l) => l.id === e.league.id).apiSports;
      assert.ok(gameFor(e, games, apiLeague), `${e.home.name} v ${e.away.name} found`);
    }
  }
  const france = named(ours("2026-11-07"), "France");
  assert.deepEqual([france.score.home, france.score.away], [34, 21], "the fixture list's score");
  const game = gameFor(france, API["2026-11-07"].response, 145);
  assert.deepEqual([game.scores.home, game.scores.away], [54, 17], "and the one played");
});

test("a game is found in its own competition only, and two that fit are none", () => {
  const [vannes] = ours("2026-11-08").filter((e) => e.home.name === "Vannes");
  const games = API["2026-11-08"].response;
  assert.equal(gameFor(vannes, games, 145), undefined, "not in the Nations Championship");
  assert.equal(gameFor({ ...vannes, start: "2026-11-08T16:00:00.000Z" }, games, 16), undefined, "not two hours off");
  const twin = games.find((g) => g.teams.home.name === "Vannes");
  assert.equal(gameFor(vannes, [...games, { ...twin, id: 1 }], 16), undefined);
});

test("what API-Sports says wins over the fixture list, but does not keep a game in play against it", () => {
  const england = named(ours("2026-11-08"), "England");
  assert.equal(england.status.state, STATE.other, "seven hours after kickoff the fixture list had lost it");
  const over = withResult(england, resultOf({ status: { short: "FT" }, scores: { home: 45, away: 22 } }));
  assert.deepEqual([over.status.state, over.score.home, over.score.away], [STATE.final, 45, 22]);
  assert.equal(over.home.logo, england.home.logo, "the fixture's crests stay");

  const finished = { ...england, status: { state: STATE.final }, score: { home: 45, away: 22 } };
  const inPlay = resultOf({ status: { short: "2H" }, scores: { home: 30, away: 22 } });
  assert.equal(withResult(finished, inPlay), finished, "a game last seen in play by polls that stopped");
  assert.equal(withResult(england, resultOf({ status: { short: "NS" } })), england, "nothing to say yet");
  const off = withResult(england, resultOf({ status: { short: "POST" }, scores: { home: null, away: null } }));
  assert.deepEqual([off.status.state, off.status.detail, off.score.home], [STATE.other, "Postponed", null]);
});

test("a live round reads today's fixtures and today's games, one call each, and keeps what it learned", async (t) => {
  const calls = network(t, { "eventsday.php?d=2026-11-08": { events: TSDB["2026-11-08"] }, "games?date=2026-11-08": API["2026-11-08"] });
  const { p, spent, meta } = provider();
  const rows = await p.live();
  assert.deepEqual(rows.map((e) => [e.home.name, e.status.state, e.score.home, e.score.away]).sort(), [
    ["England", STATE.final, 45, 22],
    ["Stade Rochelais", STATE.final, 22, 18],
    ["Vannes", STATE.final, 23, 14],
  ]);
  assert.deepEqual(spent, { api: 1, tsdb: 1 }, "each call on its own budget");
  const api = calls.find((c) => c.url.includes("api-sports"));
  assert.equal(api.headers["x-apisports-key"], "k");
  assert.equal(Object.keys(meta.results).length, 3, "and the scores are kept for the fixture list's next pass");
});

test("a game begun before midnight is still asked for after it, until three in the morning", async (t) => {
  const calls = network(t, { "eventsday.php?d=2026-11-08": { events: TSDB["2026-11-08"] }, "eventsday.php?d=2026-11-09": { events: [] }, "games?date=2026-11-08": API["2026-11-08"] });
  const { p } = provider({ now: Date.parse("2026-11-09T01:00:00Z") });
  const rows = await p.live();
  assert.equal(rows.length, 3);
  assert.equal(calls.filter((c) => c.url.includes("api-sports")).length, 1, "a day with none of ours costs no API-Sports call");
});

test("no API-Sports call for a day its free plan does not answer, without a key, or past the budget", async (t) => {
  const calls = network(t, { "eventsday.php": { events: TSDB["2026-11-07"] } });
  for (const over of [{ now: Date.parse("2026-11-09T12:00:00Z") }, { key: "" }, { spendable: 0 }]) {
    const { p } = provider(over);
    const rows = await p.byDate("2026-11-07");
    assert.equal(named(rows, "France").score.home, 34, "the fixture list's word, for want of another");
  }
  assert.ok(calls.every((c) => !c.url.includes("api-sports")));
});

test("a refusal is an error, and was still spent", async (t) => {
  network(t, { "eventsday.php": { events: TSDB["2026-11-08"] }, "games?date": { errors: { plan: "Free plans do not have access to this date" }, response: [] } });
  const { p, spent } = provider();
  await assert.rejects(p.live(), /API-Sports rugby: .*Free plans/);
  assert.equal(spent.api, 1);
});

test("the daily pass lays the scores over the fixture list's, and settles yesterday once", async (t) => {
  const calls = network(t, { "games?date=2026-11-07": API["2026-11-07"] });
  const week = Object.assign([...ours("2026-11-07"), ...ours("2026-11-08")], { partial: true, missing: ["2026-11-12"] });
  const fixtures = { daily: async () => week, byDate: async () => [] };
  const meta = {};
  const spent = { api: 0 };
  const p = rugbyProvider({ fixtures, leagues: LEAGUES, key: "k", quota: { record: () => spent.api++, spendable: () => 50 }, meta, now: () => SUNDAY_NIGHT });
  const rows = await p.daily();
  assert.deepEqual([named(rows, "France").score.home, named(rows, "France").score.away], [54, 17], "the score that was played");
  assert.equal(named(rows, "England").status.state, STATE.other, "today's games are the polls' to learn");
  assert.deepEqual([rows.partial, rows.missing], [true, ["2026-11-12"]], "a short pass still says so");
  assert.equal(meta.settled, "2026-11-07");
  await p.daily();
  assert.equal(calls.length, 1, "once a day");
});

test("a day the polls saw end is settled without asking again", async (t) => {
  const calls = network(t, {});
  const meta = { results: Object.fromEntries(ours("2026-11-07").map((e) => [e.id, { state: STATE.final, home: 1, away: 0, at: new Date(SUNDAY_NIGHT).toISOString() }])) };
  const fixtures = { daily: async () => ours("2026-11-07"), byDate: async () => [] };
  const p = rugbyProvider({ fixtures, leagues: LEAGUES, key: "k", quota: { record() {}, spendable: () => 50 }, meta, now: () => SUNDAY_NIGHT });
  await p.daily();
  assert.equal(calls.length, 0);
  assert.equal(meta.settled, "2026-11-07");
});

test("a score is kept four days, then let go", async () => {
  const [france] = ours("2026-11-07");
  const meta = { results: { [france.id]: { state: STATE.final, home: 54, away: 17, at: "2026-11-07T22:00:00.000Z" } } };
  const fixtures = { daily: async () => [], byDate: async () => [france] };
  const at = (now) => rugbyProvider({ fixtures, leagues: LEAGUES, key: "", quota: { record() {}, spendable: () => 0 }, meta, now: () => now });
  assert.equal((await at(Date.parse("2026-11-10T22:00:00Z")).byDate("2026-11-07"))[0].score.home, 54);
  await at(Date.parse("2026-11-12T00:00:00Z")).byDate("2026-11-07");
  assert.deepEqual(meta.results, {});
});
