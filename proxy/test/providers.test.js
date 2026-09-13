import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normaliseFixture } from "../src/providers/football.js";
import { normaliseGame as nflGame } from "../src/providers/nfl.js";
import { normaliseGame as nbaGame } from "../src/providers/nba.js";
import { normaliseRace } from "../src/providers/jolpica.js";
import { shortName, team } from "../src/model.js";

const fx = (n) => JSON.parse(readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url)));
const UCL = { id: 2, name: "UEFA Champions League", short: "UCL" };

test("football statuses map to live / half-time / final / scheduled", () => {
  const [live, ht, ft, ns] = fx("football").response.map((f) => normaliseFixture(f, UCL));
  assert.equal(live.status.state, "live");
  assert.match(live.status.clock, /^\d+(\+\d+)?'$/);
  assert.equal(ht.status.state, "live");
  assert.equal(ht.status.clock, undefined);
  assert.equal(ht.status.detail, "Half-time");
  assert.equal(ft.status.state, "final");
  assert.equal(typeof ft.score.home, "number");
  assert.equal(ns.status.state, "scheduled");
  assert.equal(ns.score.home, null);
  assert.equal(live.league.short, "UCL");
  assert.match(live.home.logo, /^https:\/\/media\.api-sports\.io\//);
  assert.ok(live.start.endsWith("Z"));
});

test("nfl final game", () => {
  const g = nflGame(fx("nfl").response[0], { id: 1, name: "NFL", short: "NFL" });
  assert.equal(g.status.state, "final");
  assert.ok(g.home.logo.startsWith("https://"));
  assert.equal(g.kind, "match");
  assert.equal(g.score.home + g.score.away > 0, true);
});

test("nfl live clock composes period and timer", () => {
  const raw = structuredClone(fx("nfl").response[0]);
  raw.game.status = { short: "Q3", long: "3rd Quarter", timer: "2:37" };
  const g = nflGame(raw, { id: 1, name: "NFL", short: "NFL" });
  assert.equal(g.status.state, "live");
  assert.equal(g.status.clock, "3rd 2:37");
});

test("nba shapes from the documented v2 structure", () => {
  const raw = {
    id: 1, league: "standard", season: 2026, date: { start: "2026-10-22T23:30:00.000Z" }, stage: 2,
    status: { clock: "7:02", halftime: false, short: 2, long: "In Play" }, periods: { current: 3, total: 4 },
    teams: { home: { name: "Green Bay Packers", code: "GB" }, visitors: { name: "Minnesota", code: "MIN" } },
    scores: { home: { points: 19 }, visitors: { points: 10 } },
  };
  const g = nbaGame(raw, { id: "standard", name: "NBA", short: "NBA" });
  assert.equal(g.status.state, "live");
  assert.equal(g.status.clock, "3rd 7:02");
  assert.equal(g.home.short, "GB");
  assert.equal(g.score.away, 10);
});

test("f1 race with results is final and keeps the podium", () => {
  const { races, last } = fx("f1");
  const F1 = { id: "f1", name: "Formula 1", short: "F1" };
  const done = normaliseRace(races.find((r) => r.round === last.round), F1, last.Results);
  assert.equal(done.status.state, "final");
  assert.equal(done.results.length, 3);
  assert.equal(done.results[0].pos, 1);
  assert.match(done.results[1].gap, /^\+/);
  assert.equal(done.results[0].flag, "🇮🇹");
  const future = normaliseRace(races[races.length - 1], F1, undefined);
  assert.equal(future.status.state, "scheduled");
  assert.equal(future.results, undefined);
});

test("short names and nicknames", () => {
  assert.equal(shortName("Paris Saint Germain"), "PSG");
  assert.equal(shortName("Bayern München"), "BAY");
  assert.equal(shortName("Detroit Lions"), "DET");
  assert.equal(shortName("Cardinals"), "CAR");
  assert.equal(team("Manchester City").short, "MCI");
  assert.equal(team("Green Bay Packers", undefined, { nick: true }).nick, "Packers");
  assert.equal(team("Paris Saint Germain").nick, "Paris Saint Germain");
});
