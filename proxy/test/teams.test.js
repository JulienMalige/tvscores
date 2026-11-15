import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { teamKey, withKeys, noteRoster, pruneRoster, buildTeams, ROSTER_DAYS } from "../src/teams.js";
import { Store } from "../src/cache.js";
import { buildScoreboard } from "../src/scoreboard.js";

const game = (league, home, away, extra = {}) => ({
  id: `football:tsdb:${home}${away}`, sport: "football", kind: "match", start: "2026-11-15T20:00:00Z",
  league: { id: league, name: "L" }, status: { state: "scheduled" },
  home: { name: home, short: "H", logo: `https://x/${home}.png` }, away: { name: away, short: "A" }, ...extra,
});

test("a key is the sport and the name, without accents or punctuation", () => {
  assert.equal(teamKey("football", "Paris Saint-Germain"), "football:paris-saint-germain");
  assert.equal(teamKey("football", "Atlético Madrid"), "football:atletico-madrid");
  assert.equal(teamKey("f1", "K. Antonelli"), "f1:k-antonelli");
  assert.equal(teamKey("rugby", "  "), undefined);
});

test("every side of a game and every driver of a race carries its key", () => {
  const match = withKeys(game(4334, "Paris Saint-Germain", "Olympique Lyonnais"));
  assert.equal(match.home.key, "football:paris-saint-germain");
  assert.equal(match.away.key, "football:olympique-lyonnais");
  const race = withKeys({ sport: "f1", kind: "race", results: [{ pos: 1, driver: "K. Antonelli" }] });
  assert.equal(race.results[0].key, "f1:k-antonelli");
});

test("the board hands the keys to the app", () => {
  const board = buildScoreboard([game(4334, "Paris Saint-Germain", "Lens")], { now: Date.parse("2026-11-15T12:00:00Z") });
  assert.equal(board.days.today[0].events[0].home.key, "football:paris-saint-germain");
});

test("the roster remembers who played in a competition, and forgets after a season", () => {
  const roster = {};
  const now = Date.parse("2026-11-15T12:00:00Z");
  assert.equal(noteRoster(roster, [game(4490, "France", "Italy")], now), true);
  assert.equal(noteRoster(roster, [game(4490, "France", "Italy")], now), false, "the same day again changes nothing");
  assert.deepEqual(Object.keys(roster["football:4490"]), ["football:france", "football:italy"]);
  assert.equal(roster["football:4490"]["football:france"].logo, "https://x/France.png");
  noteRoster(roster, [{ sport: "f1", kind: "race", league: { id: "f1" } }], now);
  assert.equal(roster["f1:f1"], undefined, "drivers come from the standings");
  assert.equal(pruneRoster(roster, now + (ROSTER_DAYS + 1) * 86400e3), true);
  assert.deepEqual(roster["football:4490"], {});
});

test("the store keeps the roster across a restart", () => {
  const dir = mkdtempSync(join(tmpdir(), "tvscores-teams-"));
  const store = new Store(dir);
  store.upsert([game(4490, "France", "Italy")]);
  store.save();
  assert.ok(new Store(dir).roster["football:4490"]["football:france"]);
});

test("/v1/teams: a table's rows, then whoever the roster saw, by name; no constructors", () => {
  const leagues = { football: [{ id: 4334 }, { id: 4490 }], f1: [{ id: "f1" }] };
  const tables = {
    "football:4334": { tables: [{ rows: [{ name: "Paris Saint-Germain", logo: "L1" }, { name: "Lens" }] }] },
    "f1:f1": { tables: [{ rows: [{ name: "K. Antonelli", fullName: "Kimi Antonelli", photo: "P" }] }, { rows: [{ name: "Mercedes", kind: "team" }] }] },
  };
  const roster = {
    "football:4334": { "football:paris-saint-germain": { name: "Paris Saint-Germain", logo: "old" }, "football:brest": { name: "Brest" } },
    "football:4490": { "football:france": { name: "France", logo: "F" } },
  };
  const { teams } = buildTeams({ sports: ["football", "f1"], leagues, tableFor: (id) => tables[id], roster, mirror: (u) => `m/${u}` });
  assert.deepEqual(teams["football:4334"].map((t) => t.name), ["Brest", "Lens", "Paris Saint-Germain"]);
  assert.equal(teams["football:4334"].find((t) => t.name === "Paris Saint-Germain").logo, "L1", "the table's crest first");
  assert.deepEqual(teams["football:4490"], [{ key: "football:france", name: "France", logo: "m/F" }]);
  assert.deepEqual(teams["f1:f1"], [{ key: "f1:k-antonelli", name: "Kimi Antonelli", photo: "P" }]);
  assert.equal(buildTeams({ sports: ["football"], leagues, tableFor: (id) => tables[id], roster }).teams["f1:f1"], undefined, "only the sports asked for");
});
