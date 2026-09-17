import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/cache.js";

/** A store on disk written by an older version of the proxy. */
function oldStore(schemaVersion) {
  const dir = mkdtempSync(join(tmpdir(), "tvscores-"));
  writeFileSync(join(dir, "store.json"), JSON.stringify({
    schemaVersion,
    events: [{ id: "football:12345", sport: "football", status: { state: "final" } }],
    photos: { "Max Verstappen": { url: "https://example.test/mv.png", at: "2026-09-01" } },
    meta: { football: { lastDaily: "2026-09-15T10:00:00.000Z", calls: { day: "2026-09-15", used: 12 } } },
  }));
  return dir;
}

test("a store written by this version is read back whole", () => {
  const store = new Store(oldStore(6));
  assert.equal(store.all().length, 1);
  assert.equal(Object.keys(store.photos).length, 1);
  assert.equal(store.sportMeta("football").lastDaily, "2026-09-15T10:00:00.000Z");
});

test("an older store is emptied so a provider swap cannot double up", () => {
  // The events were keyed by the previous provider's ids. Keeping them would
  // show the same match twice, once under each provider's id.
  const store = new Store(oldStore(5));
  assert.equal(store.all().length, 0);
  assert.deepEqual(store.photos, {});
  assert.equal(store.sportMeta("football").lastDaily, undefined, "and today's fetch stamp goes too, or nothing refills for hours");
  assert.deepEqual(store.sportMeta("football").calls, { day: "2026-09-15", used: 12 }, "but the quota spent today is still spent");
});

// ---- what the store keeps, and what it lets go ----
const fresh = () => new Store(mkdtempSync(join(tmpdir(), "tvscores-")));
const NOW = Date.parse("2026-09-16T12:00:00Z");
const DAY = 86400e3;
const ev = (id, over = {}) => ({ id, sport: "football", kind: "match", start: new Date(NOW - DAY).toISOString(), status: { state: "final" }, ...over });

test("old matches are pruned; a race and a game still in play are not", () => {
  const store = fresh();
  store.upsert([
    ev("football:old", { start: new Date(NOW - 4 * DAY).toISOString() }),
    ev("football:recent"),
    ev("football:stuck", { start: new Date(NOW - 4 * DAY).toISOString(), status: { state: "live" } }),
    ev("f1:round-1", { sport: "f1", kind: "race", start: new Date(NOW - 40 * DAY).toISOString() }),
  ]);
  store.prune(NOW);
  assert.deepEqual(store.all().map((e) => e.id).sort(), ["f1:round-1", "football:recent", "football:stuck"],
    "a race stays all season, and a game that was never called final is not thrown away mid-game");
});

test("a second look at the same match keeps what the first one knew", () => {
  // The live feed carries no crest; the day's fixtures did. A live update
  // overlays the score without wiping the fields it does not mention.
  const store = fresh();
  store.upsert([ev("football:1", { home: { name: "Inter", logo: "https://x/inter.png" }, score: { home: null, away: null } })]);
  store.upsert([ev("football:1", { status: { state: "live", clock: "12'" }, score: { home: 1, away: 0 } })]);
  const [m] = store.all();
  assert.equal(m.home.logo, "https://x/inter.png");
  assert.equal(m.score.home, 1);
  assert.equal(m.status.clock, "12'");
});

test("replacing a calendar sport's season leaves every other sport alone", () => {
  const store = fresh();
  store.upsert([ev("football:1"), ev("f1:r1", { sport: "f1", kind: "race" }), ev("f1:r2", { sport: "f1", kind: "race" })]);
  store.replaceSport("f1", [ev("f1:r3", { sport: "f1", kind: "race" })]);
  assert.deepEqual(store.all().map((e) => e.id).sort(), ["f1:r3", "football:1"]);
});

test("a podium is fetched once: with names it is kept, and an empty one is not retried every tick", () => {
  const store = fresh();
  const race = (over) => ev("f1:r", { sport: "f1", kind: "race", ...over });
  store.upsert([race({ status: { state: "scheduled" } })]);
  assert.equal(store.hasResults("f1:r"), false, "a race still to come has nothing to fetch");
  store.upsert([race({ status: { state: "final" } })]);
  assert.equal(store.hasResults("f1:r"), false, "finished and unfetched: ask");
  store.upsert([race({ results: [{ driver: "A" }, { driver: "B" }, { driver: "C" }] })]);
  assert.equal(store.hasResults("f1:r"), false, "a podium without full names cannot find its portraits: ask again");
  store.upsert([race({ results: [{ fullName: "A" }, { fullName: "B" }, { fullName: "C" }, { driver: "backmarker" }] })]);
  assert.equal(store.hasResults("f1:r"), true, "the podium is named; one nameless backmarker does not condemn the race");
  store.upsert([race({ results: [], resultsFetchedAt: "2026-09-16" })]);
  assert.equal(store.hasResults("f1:r"), true, "an empty classification that was tried is not tried every tick");
  assert.equal(store.hasResults("f1:nope"), false);
});
