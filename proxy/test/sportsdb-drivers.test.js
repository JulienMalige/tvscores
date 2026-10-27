import test from "node:test";
import assert from "node:assert/strict";
import { driverNationalities } from "../src/providers/sportsdb-drivers.js";
import { driverFields } from "../src/providers/ocb-rows.js";

/** TheSportsDB as the list sees it: two teams and their people, until it is told to fail. */
function sportsDb() {
  const state = { fail: false, calls: [] };
  const rosters = {
    1: [{ strPlayer: "Carlos Sainz Jr.", strNationality: "Spain" }, { strPlayer: "Alexander Albon", strNationality: "Thailand" }],
    2: [{ strPlayer: "Nico Hulkenberg", strNationality: "Germany" }, { strPlayer: "Max Verstappen", strNationality: "The Netherlands" }, { strPlayer: "Someone Unlisted" }],
  };
  state.get = async (url) => {
    state.calls.push(url);
    if (state.fail) throw new Error("503 from TheSportsDB");
    if (url.includes("/search_all_teams.php?")) return { body: { teams: [{ idTeam: "1" }, { idTeam: "2" }] } };
    return { body: { player: rosters[url.match(/id=(\d+)/)[1]] } };
  };
  return state;
}

const row = (firstName, lastName) => ({ driver: { firstName, lastName } });

test("the F1 flags come from TheSportsDB's teams, however each source spells a driver", async () => {
  const db = sportsDb();
  const nationalities = await driverNationalities({ key: "k", get: db.get })();
  assert.match(db.calls[0], /\/k\/search_all_teams\.php\?l=Formula%201$/);
  assert.equal(driverFields(row("Nico", "Hülkenberg"), nationalities).flag, "🇩🇪", "an umlaut on one side only");
  assert.equal(driverFields(row("Carlos", "Sainz"), nationalities).flag, "🇪🇸", "a Jr. on one side only");
  assert.equal(driverFields(row("Max", "Verstappen"), nationalities).flag, "🇳🇱", "a country's name, not a demonym");
  assert.equal(driverFields(row("Someone", "Unlisted"), nationalities).flag, undefined, "no nationality, no flag");
});

test("one list a day, and a refresh that fails keeps the last one", async () => {
  const db = sportsDb();
  let now = 0;
  const nationalities = driverNationalities({ key: "k", get: db.get, now: () => now });
  const first = await nationalities();
  now = 23 * 3600e3;
  await nationalities();
  assert.equal(db.calls.length, 3, "the teams, then each team's people, once");
  now = 25 * 3600e3;
  db.fail = true;
  assert.deepEqual(await nationalities(), first);
});

test("with no list yet, a failure is the caller's, who goes without flags", async () => {
  const db = sportsDb();
  db.fail = true;
  await assert.rejects(driverNationalities({ key: "k", get: db.get })(), /503/);
});
