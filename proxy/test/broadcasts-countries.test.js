import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store, SCHEMA_VERSION } from "../src/cache.js";
import { TvChannels } from "../src/broadcasts.js";
import { buildScoreboard } from "../src/scoreboard.js";
import { english } from "../src/tv-names.js";
import { tsdbChannelName } from "../src/tv-channels.js";
import { eventIndex, matchProgramme } from "../src/tv-match.js";

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const GUIDES = { US: fixture("xmltv-us.xml"), BR: fixture("xmltv-br.xml"), FR: '<tv><channel id="TF1.fr"></channel><programme start="20261010184000 +0000" channel="TF1.fr"><title>Football : Ligue des Nations UEFA</title><desc>L\'Allemagne reçoit l\'Angleterre.</desc></programme></tv>' };
const RIGHTS = Object.fromEntries(["FR", "US", "BR"].map((cc) => [cc, JSON.parse(readFileSync(new URL(`../broadcasts-${cc.toLowerCase()}.json`, import.meta.url))).rights]));
async function* chunks(text, size = 41) {
  for (let i = 0; i < text.length; i += size) yield text.slice(i, i + size);
}

const game = (id, sport, league, start, home, away) => ({
  id: `${sport}:tsdb:${id}`, sport, league: { id: league, name: String(league) }, kind: "match", start, status: { state: "scheduled" },
  home: { name: home }, away: { name: away }, score: { home: null, away: null },
});
const EVENTS = [
  game(1, "nfl", 4391, "2026-10-11T17:00:00.000Z", "Buffalo Bills", "New England Patriots"),
  game(2, "nfl", 4391, "2026-10-11T17:00:00.000Z", "Chicago Bears", "New York Jets"),
  game(3, "nfl", 4391, "2026-10-12T00:20:00.000Z", "Carolina Panthers", "Detroit Lions"),
  game(4, "nba", 4387, "2026-10-10T23:00:00.000Z", "Denver Nuggets", "Utah Jazz"),
  game(5, "football", 4490, "2026-10-10T18:45:00.000Z", "Germany", "England"),
  game(6, "football", 4351, "2026-10-10T22:00:00.000Z", "São Paulo", "Corinthians"),
  game(7, "football", 4351, "2026-10-10T21:00:00.000Z", "Atlético Mineiro", "Bragantino"),
  {
    id: "motogp:ocb:jpn", sport: "motogp", league: { id: "motogp", name: "MotoGP" }, kind: "race", start: "2026-10-11T05:00:00.000Z", status: { state: "scheduled" },
    sessions: [{ kind: "race", start: "2026-10-11T05:00:00.000Z" }],
  },
];
const TSDB = {
  "United States": [
    { idEvent: "1", strChannel: "Paramount+ US", strCountry: "United States" },
    { idEvent: "1", strChannel: "WBAL TV", strCountry: "United States" },
    { idEvent: "2", strChannel: "Fox Sports 1 HD US", strCountry: "United States" },
  ],
  Brazil: [
    { idEvent: "5", strChannel: "ESPN Brasil", strCountry: "Brazil" },
    { idEvent: "5", strChannel: "Fox Sports 1 BR", strCountry: "Brazil" },
  ],
  France: [],
};
const NOW = Date.parse("2026-10-09T06:00:00Z");

function setup(dir = mkdtempSync(join(tmpdir(), "tvs-tvc-"))) {
  const store = new Store(dir);
  store.upsert(EVENTS);
  const opened = [];
  const tv = new TvChannels({
    store, countries: ["FR", "US", "BR"], key: "k", rights: RIGHTS, cfg: { dailyRefreshHourUtc: 4 },
    fetchJson: async (url) => ({ body: { filter: TSDB[decodeURIComponent(url.split("/").pop())] } }),
    openGuide: async (url) => {
      const cc = url.includes("US2") ? "US" : url.includes("BR2") ? "BR" : "FR";
      opened.push(cc);
      return chunks(GUIDES[cc]);
    },
  });
  const of = (id) => tv.for(store.events.get(id));
  return { store, tv, of, opened, dir };
}

test("TheSportsDB's US and Brazilian names are put in ours; local stations dropped", () => {
  assert.equal(tsdbChannelName("Fox Sports 1 HD US", "US"), "FS1");
  assert.equal(tsdbChannelName("ESPN 2 US", "US"), "ESPN2");
  assert.equal(tsdbChannelName("Amazon Prime Video US", "US"), "Prime Video");
  assert.equal(tsdbChannelName("WBAL TV", "US"), "");
  assert.equal(tsdbChannelName("NBC (WCAU Philadelphia only)", "US"), "");
  assert.equal(tsdbChannelName("NFL Sunday Ticket", "US"), "");
  assert.equal(tsdbChannelName("ESPN 2 Brazil", "BR"), "ESPN 2");
  assert.equal(tsdbChannelName("Fox Sports 1 BR", "BR"), "ESPN 4");
  assert.equal(tsdbChannelName("Canais Globo", "BR"), "Globo");
});

test("Portuguese and American names read as our feeds spell them", () => {
  assert.equal(english("Alemanha", "pt"), "germany");
  assert.equal(english("Estados Unidos", "pt"), "usa");
  assert.equal(english("Irlanda do Norte", "pt"), "northern ireland");
  assert.equal(english("Atlético-MG", "pt"), "atletico mineiro");
  assert.equal(english("United States", "en"), "usa");
});

test("a Brazilian 'x', an American 'at', and a competition named in each language", () => {
  const index = eventIndex(EVENTS);
  const at = (p, lang) => matchProgramme({ subTitle: "", desc: "", ...p }, index, lang);
  assert.deepEqual(at({ start: "2026-10-10T18:40:00Z", title: "Holanda x Sérvia - Ao Vivo" }, "pt"), []);
  assert.deepEqual(at({ start: "2026-10-10T18:40:00Z", title: "Alemanha x Inglaterra - Ao Vivo" }, "pt"), ["football:tsdb:5"]);
  assert.deepEqual(at({ start: "2026-10-10T23:00:00Z", title: "NBA: Pré-Temporada: Utah Jazz x Denver Nuggets - Ao Vivo" }, "pt"), ["nba:tsdb:4"]);
  assert.deepEqual(at({ start: "2026-10-12T00:15:00Z", title: "NFL Football: Lions at Panthers" }, "en"), ["nfl:tsdb:3"]);
  assert.deepEqual(at({ start: "2026-10-10T18:40:00Z", title: "Live: UEFA Nations League Soccer" }, "en"), ["football:tsdb:5"]);
  assert.deepEqual(at({ start: "2026-10-10T21:00:00Z", title: "Campeonato Brasileiro Série A" }, "pt"), ["football:tsdb:7"]);
  assert.deepEqual(at({ start: "2026-10-11T04:15:00Z", title: "MotoGP: GP do Japão - Ao Vivo" }, "pt"), ["motogp:ocb:jpn"]);
  assert.deepEqual(at({ start: "2026-10-11T17:00:00Z", title: "NFL Redzone - Ao Vivo" }, "pt"), [], "every game at once is none of them");
});

test("each country's three sources, side by side", async () => {
  const { tv, of, opened } = setup();
  await tv.refresh(NOW);
  // One guide at a time, in the configured order.
  assert.deepEqual(opened, ["FR", "US", "BR"]);
  assert.deepEqual(of("nfl:tsdb:1"), { US: ["Paramount+"], BR: ["SporTV 2"] });
  // A rerun (VT) in Brazil; the US feed's FS1 row.
  assert.deepEqual(of("nfl:tsdb:2"), { US: ["FS1"] });
  // NBC by competition and description; a regional network's listing ignored.
  assert.deepEqual(of("nfl:tsdb:3"), { US: ["NBC"] });
  assert.deepEqual(of("nba:tsdb:4"), { US: ["ESPN"] });
  // France by description, Brazil by feed then guide, the US rerun skipped: FOX Sports from the table.
  assert.deepEqual(of("football:tsdb:5"), { FR: ["TF1"], US: ["FOX Sports"], BR: ["ESPN", "ESPN 4"] });
  // A women's game at the men's kickoff is not it.
  assert.deepEqual(of("football:tsdb:6"), {});
  assert.deepEqual(of("football:tsdb:7"), { BR: ["Premiere"] });
  assert.deepEqual(of("motogp:ocb:jpn"), { FR: ["Canal+"], US: ["FS1"], BR: ["Disney+"] });
});

test("rights rows by tier and by city, per country", () => {
  const { tv } = setup();
  const tennis = (league, tier, city) => tv.for({ id: `tennis:${tier}`, sport: "tennis", league: { id: league }, start: "2026-10-10T10:00:00Z", competition: { tier, city } });
  assert.deepEqual(tennis("wta", "WTA 1000", "Beijing"), { FR: ["beIN Sports"], US: ["Tennis Channel"], BR: ["Disney+"] });
  assert.deepEqual(tennis("atp", "ATP 500", "Tokyo"), { US: ["Tennis Channel"], BR: ["Disney+"] });
  assert.deepEqual(tennis("atp", "Grand Slam", "Paris"), { US: ["HBO Max", "TNT"], BR: ["Disney+"] });
  assert.deepEqual(tennis("wta", "Grand Slam", "Melbourne"), { US: ["ESPN"], BR: ["Disney+"] });
  assert.deepEqual(tennis("atp", "ATP 250", "Antwerp"), {});
});

test("the board keeps France's list as `broadcasts` and adds every country's", async () => {
  const { tv, store } = setup();
  await tv.refresh(NOW);
  const board = buildScoreboard(store.all(), { now: NOW, broadcastsFor: (e) => tv.for(e), upcomingDays: 7 });
  const events = board.days.upcoming.flatMap((g) => g.events);
  const byId = (id) => events.find((e) => e.id === id);
  assert.deepEqual(byId("football:tsdb:5").broadcasts, ["TF1"]);
  assert.deepEqual(byId("football:tsdb:5").broadcastsBy, { FR: ["TF1"], US: ["FOX Sports"], BR: ["ESPN", "ESPN 4"] });
  assert.equal("broadcasts" in byId("nfl:tsdb:1"), false);
  assert.deepEqual(byId("nfl:tsdb:1").broadcastsBy, { US: ["Paramount+"], BR: ["SporTV 2"] });
  assert.equal("broadcastsBy" in byId("football:tsdb:6"), false);
});

test("France's channels saved before the other countries move under FR, and are not fetched again that day", async () => {
  const dir = mkdtempSync(join(tmpdir(), "tvs-tvm-"));
  const ok = new Date(NOW).toISOString();
  writeFileSync(join(dir, "store.json"), JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    events: EVENTS, broadcasts: { tsdb: { 4: ["beIN Sports Max 5"] }, xmltv: {} },
    meta: { broadcasts: { calls: { day: "", used: 0 }, sources: { tsdb: { ok }, xmltv: { ok } }, lastOk: ok } },
  }));
  const { tv, of, opened, store } = setup(dir);
  assert.deepEqual(store.broadcasts.FR.tsdb, { 4: ["beIN Sports Max 5"] });
  assert.equal(store.meta.broadcasts, undefined);
  await tv.refresh(NOW + 3600e3);
  assert.deepEqual(opened, ["US", "BR"]);
  assert.deepEqual(of("nba:tsdb:4").FR, ["beIN Sports Max 5"]);
});
