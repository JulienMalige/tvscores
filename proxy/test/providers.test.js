import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normaliseRace } from "../src/providers/jolpica.js";
import { shortName, team } from "../src/model.js";

const fx = (n) => JSON.parse(readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url)));

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
