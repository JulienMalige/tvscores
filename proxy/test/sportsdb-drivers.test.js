import test from "node:test";
import assert from "node:assert/strict";
import { driverNationalities } from "../src/providers/sportsdb-drivers.js";
import { driverFields } from "../src/providers/ocb-rows.js";

/** TheSportsDB as the list sees it: two teams and their people, until it is told to fail. */
function sportsDb() {
  const state = { fail: false, calls: [] };
  const driver = (strPlayer, strNationality) => ({ strPlayer, strNationality, strPosition: "Driver" });
  const rosters = {
    1: [driver("Carlos Sainz Jr.", "Spain"), driver("Alexander Albon", "Thailand"), { strPlayer: "Someone Albon", strNationality: "Wales", strPosition: "Manager" }],
    2: [driver("Nico Hulkenberg", "Germany"), driver("Max Verstappen", "The Netherlands"), { strPlayer: "Someone Unlisted", strPosition: "Driver" }],
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
  assert.equal(driverFields(row("Alexander", "Albon"), nationalities).flag, "🇹🇭", "a driver's, not the team manager's of the same name");
  assert.equal(driverFields(row("Someone", "Unlisted"), nationalities).flag, undefined, "no nationality, no flag");
});

test("one list a day; a refresh that fails keeps the last one, and is not tried again at once", async () => {
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
  now += 60e3;
  assert.deepEqual(await nationalities(), first);
  assert.equal(db.calls.length, 4, "a minute after a failure, no call");
  now += 5 * 60e3;
  db.fail = false;
  await nationalities();
  assert.equal(db.calls.length, 7, "five minutes after it, the list again");
});

test("with no list yet, a failure is the caller's, who goes without flags", async () => {
  const db = sportsDb();
  db.fail = true;
  const nationalities = driverNationalities({ key: "k", get: db.get });
  await assert.rejects(nationalities(), /503/);
  await assert.rejects(nationalities(), /last try failed/);
  assert.equal(db.calls.length, 1, "and the second ask waits its turn");
});
