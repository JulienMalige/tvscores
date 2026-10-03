import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/cache.js";
import { Broadcasts } from "../src/broadcasts.js";
import { buildScoreboard } from "../src/scoreboard.js";
import { tsdbChannelName, english } from "../src/tv-names.js";
import { xmltvElements, xmltvTime, programme } from "../src/xmltv.js";

const GUIDE = readFileSync(new URL("./fixtures/xmltv-fr.xml", import.meta.url), "utf8");
/** The guide in small pieces, so elements straddle chunk boundaries. */
async function* chunks(text = GUIDE, size = 37) {
  for (let i = 0; i < text.length; i += size) yield text.slice(i, i + size);
}

const BUNDESLIGA = { id: 4331, name: "Bundesliga", short: "BUN" };
const match = (id, sport, league, start, home, away) => ({
  id: `${sport}:tsdb:${id}`, sport, league, kind: "match", start, status: { state: "scheduled" },
  home: { name: home }, away: { name: away }, score: { home: null, away: null },
});
const EVENTS = [
  match(2508373, "football", BUNDESLIGA, "2026-10-10T13:30:00.000Z", "Augsburg", "Bayern Munich"),
  match(2508376, "football", BUNDESLIGA, "2026-10-10T13:30:00.000Z", "Mainz 05", "SC Freiburg"),
  match(2501001, "football", { id: 4328, name: "Premier League" }, "2026-10-10T11:30:00.000Z", "Manchester City", "Sunderland"),
  // Two NFL games at once: a listing naming only "NFL" cannot say which.
  match(1, "nfl", { id: 4391, name: "NFL" }, "2026-10-11T17:00:00.000Z", "Buffalo Bills", "New England Patriots"),
  match(2, "nfl", { id: 4391, name: "NFL" }, "2026-10-11T17:00:00.000Z", "Chicago Bears", "New York Jets"),
  match(3, "nfl", { id: 4391, name: "NFL" }, "2026-10-12T00:20:00.000Z", "Carolina Panthers", "Detroit Lions"),
  match(4, "nba", { id: 4387, name: "NBA" }, "2026-10-10T23:00:00.000Z", "Denver Nuggets", "Utah Jazz"),
  {
    id: "f1:ocb:sgp", sport: "f1", league: { id: "f1", name: "Formula 1" }, kind: "race", start: "2026-10-11T12:00:00.000Z",
    status: { state: "scheduled" },
    sessions: [{ kind: "qualifying", start: "2026-10-10T13:00:00.000Z" }, { kind: "race", start: "2026-10-11T12:00:00.000Z" }],
  },
];
const TSDB = {
  filter: [
    { idEvent: "2508373", strChannel: "BeIn Sports Max 5", strCountry: "France", strLogo: "https://r2.thesportsdb.com/x.png" },
    { idEvent: "2508373", strChannel: "BeIn Sports Max 6", strCountry: "France" },
    { idEvent: "4", strChannel: "BeIn Sports Max 5", strCountry: "France" },
  ],
};
// The real table, so its labels are tested against the feed's (review, build 33).
const TABLE = JSON.parse(readFileSync(new URL("../broadcasts-fr.json", import.meta.url))).rights;
const NOW = Date.parse("2026-10-09T06:00:00Z");

function setup({ guide = () => chunks(), json = async () => ({ body: TSDB }) } = {}) {
  const store = new Store(mkdtempSync(join(tmpdir(), "tvs-tv-")));
  store.upsert(EVENTS);
  const calls = { json: 0, guide: 0 };
  const tv = new Broadcasts({
    store, country: "FR", key: "k", table: TABLE, cfg: { dailyRefreshHourUtc: 4 },
    fetchJson: async (url, opts) => (calls.json++, calls.url = url, calls.headers = opts.headers, json()),
    openGuide: async () => (calls.guide++, guide()),
  });
  const of = (id) => tv.for(store.events.get(id));
  return { store, tv, calls, of };
}

test("TheSportsDB's channel names are put in ours, links dropped", () => {
  assert.equal(tsdbChannelName("BeIn Sports HD 1 France"), "beIN Sports 1");
  assert.equal(tsdbChannelName("BeIn Sports Max 5"), "beIN Sports Max 5");
  assert.equal(tsdbChannelName("Ligue 1+ 2 FR"), "Ligue 1+ 2");
  assert.equal(tsdbChannelName("Ligue 1+ 1 FR"), "Ligue 1+");
  assert.equal(tsdbChannelName("DAZN 1 France"), "DAZN 1");
  assert.equal(tsdbChannelName("Canal+ France"), "Canal+");
  assert.equal(tsdbChannelName("https://www.canalplus.com"), "");
});

test("French names in a guide read as our feeds spell them", () => {
  assert.equal(english("Naples"), "napoli");
  assert.equal(english("Pays-Bas"), "netherlands");
  assert.equal(english("Bayern"), "bayern munich");
  assert.equal(english("Irlande du Nord"), "northern ireland");
});

test("the guide is read element by element, across chunk boundaries", async () => {
  const seen = [];
  for await (const el of xmltvElements(chunks(GUIDE, 11))) seen.push(el.tag === "channel" ? `c:${el.attrs.id}` : programme(el));
  assert.deepEqual(seen.slice(0, 2), ["c:beINSPORTSMAX5.fr", "c:LaUne.be"]);
  const progs = seen.filter((x) => typeof x === "object");
  assert.equal(progs.length, 9);
  assert.equal(progs[0].start, "2026-10-10T13:30:00.000Z");
  assert.equal(progs[0].subTitle, "Augsbourg / Bayern Munich. Bundesliga. 6e journée.");
  assert.equal(progs[4].title, "Football américain : NFL");
  assert.equal(progs[3].rerun, true);
  assert.equal(xmltvTime("20261003143000 -0130"), "2026-10-03T16:00:00.000Z");
});

test("TheSportsDB first, the guide's additions after, the rights table only when both are silent", async () => {
  const { tv, calls, of } = setup();
  await tv.refresh(NOW);
  assert.match(calls.url, /\/filter\/tv\/country\/France$/);
  assert.equal(calls.headers["X-API-KEY"], "k");
  // Both beIN channels from the feed; the guide's MAX 5 is the same name.
  assert.deepEqual(of("football:tsdb:2508373"), ["beIN Sports Max 5", "beIN Sports Max 6"]);
  // The guide alone: French names, the same kickoff, on another channel.
  assert.deepEqual(of("football:tsdb:2508376"), ["beIN Sports Max 6"]);
  // A rerun at kickoff time is not the game; the table says Canal+.
  assert.deepEqual(of("football:tsdb:2501001"), ["Canal+"]);
  // "NFL" with two games at that hour: no guess. With one: that one.
  assert.deepEqual(of("nfl:tsdb:1"), []);
  assert.deepEqual(of("nfl:tsdb:2"), []);
  assert.deepEqual(of("nfl:tsdb:3"), ["beIN Sports 1"]);
  // A race weekend matches on its qualifying; Bahrain at another time does not.
  assert.deepEqual(of("f1:ocb:sgp"), ["Canal+ Sport"]);
  // Teams named, but not at their kickoff: only the feed's row counts.
  assert.deepEqual(of("nba:tsdb:4"), ["beIN Sports Max 5"]);
  assert.deepEqual(tv.for({ id: "tennis:9", sport: "tennis", league: { id: "atp" }, start: "2026-10-10T10:00:00Z", competition: { tier: "Masters 1000" } }), ["Eurosport"]);
  assert.deepEqual(tv.for({ id: "tennis:8", sport: "tennis", league: { id: "atp" }, start: "2026-10-10T10:00:00Z", competition: { tier: "ATP 500" } }), []);
  // The feed's own label for a 1000, not only our calendar's (review, build 33).
  assert.deepEqual(tv.for({ id: "tennis:7", sport: "tennis", league: { id: "atp" }, start: "2026-10-10T10:00:00Z", competition: { tier: "ATP 1000" } }), ["Eurosport"]);
  // A WTA match at a major is not beIN's: Roland-Garros is France TV's.
  assert.deepEqual(tv.for({ id: "tennis:6", sport: "tennis", league: { id: "wta" }, start: "2026-10-10T10:00:00Z", competition: { tier: "Grand Slam" } }), []);
  assert.deepEqual(tv.for({ id: "tennis:5", sport: "tennis", league: { id: "wta" }, start: "2026-10-10T10:00:00Z", competition: { tier: "WTA 1000" } }), ["beIN Sports"]);
});

test("once a day per source; a failed download keeps the last answer and backs off", async () => {
  let broken = false;
  const { tv, calls, of, store } = setup({ guide: () => { if (broken) throw new Error("HTTP 503"); return chunks(); } });
  await tv.refresh(NOW);
  await tv.refresh(NOW + 3600e3);
  assert.deepEqual([calls.json, calls.guide], [1, 1]);
  // Next UTC day, before the schedules' hour: nothing yet.
  const tomorrow = Date.parse("2026-10-10T03:00:00Z");
  await tv.refresh(tomorrow);
  assert.deepEqual([calls.json, calls.guide], [1, 1]);
  // After it, once the team schedules have had their pass (or three hours later).
  broken = true;
  const later = Date.parse("2026-10-10T08:00:00Z");
  await tv.refresh(later);
  assert.deepEqual([calls.json, calls.guide], [2, 2]);
  assert.deepEqual(of("football:tsdb:2508376"), ["beIN Sports Max 6"]);
  assert.match(store.meta.broadcasts.lastError.message, /xmltv: HTTP 503/);
  await tv.refresh(later + 10 * 60e3);
  assert.equal(calls.guide, 2);
  broken = false;
  await tv.refresh(later + 31 * 60e3);
  assert.equal(calls.guide, 3);
  assert.equal(store.meta.broadcasts.sources.xmltv.failures, 0);
});

test("a guide with none of our channels is a failure, not an empty week", async () => {
  const { tv, store } = setup({ guide: () => chunks('<tv><programme start="20261010153000 +0200" channel="LaUne.be"><title>x</title></programme></tv>') });
  await tv.refresh(NOW);
  assert.match(store.meta.broadcasts.lastError.message, /none of our channels/);
});

test("the board carries the names, and nothing when there are none", async () => {
  const { tv, store } = setup();
  await tv.refresh(NOW);
  const board = buildScoreboard(store.all(), { now: NOW, broadcastsFor: (e) => tv.for(e), upcomingDays: 7 });
  const events = board.days.upcoming.flatMap((g) => g.events);
  assert.deepEqual(events.find((e) => e.id === "nfl:tsdb:3").broadcasts, ["beIN Sports 1"]);
  assert.equal("broadcasts" in events.find((e) => e.id === "nfl:tsdb:1"), false);
});

test("a listing naming both teams may open an hour before kickoff; a guess by competition may not", async () => {
  // Review, build 33: Ligue 1+ starts Lens / Lyon at 17:45Z for an 18:45Z
  // kickoff, and only DAZN's later listing was matched.
  const { eventIndex, matchProgramme } = await import("../src/tv-match.js");
  const lens = { id: "football:tsdb:2489515", sport: "football", kind: "match", league: { id: 4334 }, start: "2026-10-09T18:45:00Z", home: { name: "Lens" }, away: { name: "Lyon" } };
  const nfl = { id: "nfl:tsdb:9", sport: "nfl", kind: "match", league: { id: 4391 }, start: "2026-10-09T18:45:00Z", home: { name: "Dallas Cowboys" }, away: { name: "Tampa Bay Buccaneers" } };
  const index = eventIndex([lens, nfl]);
  assert.deepEqual(matchProgramme({ start: "2026-10-09T17:45:00Z", title: "Football : Ligue 1 McDonald's - Lens / Lyon", subTitle: "" }, index), [lens.id]);
  assert.deepEqual(matchProgramme({ start: "2026-10-09T17:45:00Z", title: "Football américain : NFL", subTitle: "" }, index), [], "an hour early is too early to guess");
});

test("several games at once: the description's first game named in full is the one", async () => {
  // Julien, build 34: Nations League listings name only the competition.
  const { eventIndex, matchProgramme } = await import("../src/tv-match.js");
  const at = "2026-10-05T18:45:00Z";
  const game = (id, home, away) => ({ id, sport: "football", kind: "match", league: { id: 4490 }, start: at, home: { name: home }, away: { name: away } });
  const index = eventIndex([game("a", "France", "Belgium"), game("b", "Italy", "Turkey"), game("c", "Wales", "Denmark")]);
  const listing = (desc) => ({ start: "2026-10-05T18:39:00Z", title: "Football : Ligue des Nations UEFA", subTitle: "", desc });
  assert.deepEqual(matchProgramme(listing("Après avoir raté son entrée en lice à Rome face à la Belgique, l'Italie s'est rassurée en Turquie… avant le Stade de France."), index), ["b"]);
  assert.deepEqual(matchProgramme(listing("La Croatie accueille l'Angleterre."), index), [], "no game of ours named: no guess");
});
