import test from "node:test";
import assert from "node:assert/strict";
import { createWatch, MAX_CARDS } from "../src/watch.js";
import { buildScoreboard } from "../src/scoreboard.js";
import { config } from "../src/config.js";

const app = (name, kind, tvos, id = 1, extra = {}) => ({ name, kind, tvos, appStoreId: id, ...extra });
const table = {
  apps: {
    own: app("Own", "own", ["FR"]), stream: app("Stream", "streamer", ["FR", "BR"]), prov: app("Prov", "provider", ["FR"]),
    other: app("Other", "provider", ["FR"]), more: app("More", "provider", ["FR"]), phone: app("Phone only", "own", []),
    built: app("Built in", "streamer", [], null, { builtIn: true }), split: app("Split", "streamer", ["US", "BR"], { US: 11, BR: 22 }),
  },
  channels: {
    FR: { "Chan": ["prov", "stream", "own"], "Chan Max": ["other"], "Pay": ["phone", "prov"], "Many": ["prov", "other", "more", "stream", "own"], "Apple": ["built"] },
    BR: { "Chan": ["stream"], "S": ["split"] },
    US: { "S": ["split"] },
  },
};
const watch = createWatch(table);

test("a game's apps are its own, then streaming services, then providers", () => {
  assert.deepEqual(watch.forEvent({ FR: ["Chan"] }), { FR: ["own", "stream", "prov"] });
});

test("a numbered channel is found by its base name, and 'Max' too", () => {
  assert.deepEqual(watch.forEvent({ FR: ["Chan 3"] }), { FR: ["own", "stream", "prov"] });
  assert.deepEqual(watch.forEvent({ FR: ["Chan Max 7"] }), { FR: ["other"] });
});

test("an app with no tvOS version in the country is no card, a built-in one always is", () => {
  assert.deepEqual(watch.forEvent({ FR: ["Pay"] }), { FR: ["prov"] }, "the phone-only app is left out");
  assert.deepEqual(watch.forEvent({ FR: ["Apple"] }), { FR: ["built"] });
  assert.deepEqual(watch.forEvent({ BR: ["Chan"] }), { BR: ["stream"] }, "the same channel name in another country is another list");
});

test("several channels of one game share their apps once, and at most four cards are kept", () => {
  assert.deepEqual(watch.forEvent({ FR: ["Chan", "Pay"] }), { FR: ["own", "stream", "prov"] });
  const many = watch.forEvent({ FR: ["Many"] }).FR;
  assert.equal(many.length, MAX_CARDS);
  assert.deepEqual(many, ["own", "stream", "prov", "other"], "own first, then the streamer, then providers in the table's order");
});

test("a country with nothing to open, or an unknown channel, says nothing", () => {
  assert.deepEqual(watch.forEvent({ FR: ["Nobody"], BR: ["Pay"] }), {});
  assert.deepEqual(watch.forEvent(undefined), {});
});

test("the board names an app with the id the store needs and the countries it has a tvOS app in", () => {
  const cards = watch.describe(new Set(["split", "own"]));
  assert.deepEqual(Object.keys(cards), ["own", "split"]);
  assert.deepEqual(cards.split, { name: "Split", kind: "streamer", id: { US: 11, BR: 22 }, countries: ["US", "BR"] }, "an id per country when the store's listing differs");
  assert.deepEqual(watch.keys().sort(), ["built", "more", "other", "own", "phone", "prov", "split", "stream"], "and every key of the table is there to be listed");
  assert.equal(watch.describe(new Set(["built"])).built.builtIn, true);
});

test("an event on the board carries watchOn, and the board carries the apps", () => {
  const game = { id: "football:tsdb:1", sport: "football", kind: "match", league: { id: 4328, name: "Premier League", short: "PL" }, start: new Date().toISOString(), status: { state: "scheduled" }, home: { name: "A", short: "A" }, away: { name: "B", short: "B" }, score: { home: null, away: null } };
  const real = createWatch(config.channelApps);
  const board = buildScoreboard([game], { tz: "UTC", watch: real, broadcastsFor: () => ({ FR: ["Canal+ Foot"], BR: ["ESPN 2"] }), leagues: config.leagues, sportOrder: config.sportOrder });
  const event = Object.values(board.days).flat().flatMap((g) => g.events)[0];
  assert.ok(event.watchOn.FR.includes("canalplus"), "Canal+ Foot opens in the CANAL+ app");
  assert.ok(event.watchOn.BR.includes("disneyplus"), "ESPN in Brazil opens in Disney+");
  for (const keys of Object.values(event.watchOn)) assert.ok(keys.length <= MAX_CARDS);
  for (const key of Object.values(event.watchOn).flat()) assert.ok(board.apps[key], `${key} is described`);
  assert.deepEqual(Object.keys(board.apps).sort(), Object.keys(config.channelApps.apps).sort(), "the board names every app of the table, for Settings to list");
  const bare = buildScoreboard([game], { tz: "UTC", leagues: config.leagues, sportOrder: config.sportOrder });
  assert.equal(bare.apps, undefined, "a board built without the table has no apps");
});

test("a competition's own app comes last, for every country the table lists, and keeps the fourth place", () => {
  const withNba = createWatch({
    ...table,
    competitions: { 77: { name: "X", apps: { FR: ["own"], BR: ["stream"], US: ["split"] } } },
  });
  // Many (own, stream, prov, other, more): own is a channel app and a complement: it is not shown twice, and it stays last.
  assert.deepEqual(withNba.forEvent({ FR: ["Many"] }, 77).FR, ["stream", "prov", "other", "own"], "three channel apps, then the competition's");
  assert.deepEqual(withNba.forEvent({ FR: ["Chan"] }, 77).FR, ["stream", "prov", "own"]);
  assert.deepEqual(withNba.forEvent({}, 77), { FR: ["own"], BR: ["stream"], US: ["split"] }, "with no channel at all, every country whose complement opens");
});

test("a game of a competition with no complement is as before, and the real table lists the NBA and the NFL", () => {
  assert.deepEqual(watch.forEvent({ FR: ["Chan"] }, 999), { FR: ["own", "stream", "prov"] });
  const real = createWatch(config.channelApps);
  const nba = real.forEvent({ BR: ["ESPN 2"] }, 4387);
  assert.equal(nba.BR.at(-1), "nba", "the NBA app after ESPN's, in Brazil");
  assert.equal(nba.FR.at(-1), "nba");
  assert.equal(nba.US.at(-1), "nba");
  const nfl = real.forEvent({}, 4391);
  assert.deepEqual(nfl, { US: ["nfl"], FR: ["dazn"], BR: ["dazn"] }, "the NFL app in the US, DAZN's Game Pass elsewhere");
  assert.deepEqual(real.forEvent({}, 4351), { BR: ["premiere"] }, "the Brasileirão's own app is Premiere, in Brazil");
  assert.equal(real.forEvent({ BR: ["SporTV"] }, 4351).BR.at(-1), "premiere", "after the channels' apps");
});
