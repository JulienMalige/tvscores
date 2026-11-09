import test from "node:test";
import assert from "node:assert/strict";
import { calls, linkOf, tablesIn } from "../src/wiki-tables.js";
import { finishedIn, matchSides, rugbyTables, sidesOf, standingsFrom, years } from "../src/rugby-tables.js";

// Made-up tables in the two shapes Wikipedia writes them: English
// Wikipedia's Sports table and French Wikipedia's Cls Rugby lines.
const SPORTS_TABLE = `
==Table==
{{#invoke:sports table|main|style=Rugby
| title = Made-up table
<!-- the order below is the ranking -->
| team1 = LEI | name_LEI = [[Leicester Tigers]]
| team3 = GLO | name_GLO = [[Gloucester Rugby|Gloucester]]
| team2 = NOR | name_NOR = {{nowrap|[[Northampton Saints]]}}
| win_LEI = 4| draw_LEI = 0| loss_LEI = 1| pf_LEI = 150| pa_LEI = 113| tb_LEI = 4| lb_LEI = 1
| win_NOR = 3| draw_NOR = 1| loss_NOR = 1| pf_NOR = 191| pa_NOR = 157| tb_NOR = 4| lb_NOR = 0
| win_GLO = 3| draw_GLO = 0| loss_GLO = 2| pf_GLO = 161| pa_GLO = 95| tb_GLO = 3| lb_GLO = 1| adjust_points_GLO = -5
|update=31 October 2026 | source = PREM<ref>{{cite web |title=Standings {{!}} PREM |url=https://example.org}}</ref>
}}
{{#invoke:sports table|main|style=WDL
| team1 = ARS | win_ARS = 9
}}`;

const CLS_RUGBY = `
{{Classement début Rugby|essai=oui|date={{date|7|11}}|titre=Classement}}
{{Cls_Rugby|p=1 |club=ru Toulouse |v=7|n=0|d=2|em=40|ee=26|bo=3|bd=1|pp=277|pc=209|s={{tenant du titre}}|c={{Rugbyc|qualifié_1a}}}}
{{Cls Rugby|p=2 |club=ru Pau      |v=6|n=1|d=1|bo=2|bd=0|pp=293|pc=236|pén=2}}
{{Cls_Rugby|p=3 |club=ru Vannes   |v=1|n=0|d=7|bo=0|bd=1|pp=169|pc=250|pts=3}}
|}`;

test("a Sports table reads in its ranking, with the points its module counts", () => {
  const [table, ...others] = tablesIn(SPORTS_TABLE);
  assert.equal(others.length, 0, "a table that is not rugby's is not read as one");
  assert.deepEqual(table.rows.map((r) => r.name), ["[[Leicester Tigers]]", "{{nowrap|[[Northampton Saints]]}}", "[[Gloucester Rugby|Gloucester]]"],
    "team1, team2, team3 whatever order they are written in");
  assert.deepEqual(table.rows[0], { name: "[[Leicester Tigers]]", w: 4, d: 0, l: 1, pf: 150, pa: 113, bonus: 5, pts: 21 });
  assert.equal(table.rows[1].pts, 3 * 4 + 2 + 4, "a draw is two");
  assert.equal(table.rows[2].pts, 3 * 4 + 4 - 5, "points taken off are taken off");
});

test("a table can say its order in one line, and what a win is worth", () => {
  const [table] = tablesIn(`{{#invoke:Sports table|main|style=Rugby |winpoints=3
|team_order=B, A
|name_A=A |win_A=1 |name_B=B |win_B=2 |tb_B=1}}`);
  assert.deepEqual(table.rows.map((r) => [r.name, r.pts]), [["B", 7], ["A", 3]]);
});

test("French Wikipedia's lines read under their heading, a total set by hand kept as set", () => {
  const [table] = tablesIn(CLS_RUGBY);
  assert.deepEqual(table.rows.map((r) => r.name), ["{{chemin équipes rugby à XV|ru Toulouse}}", "{{chemin équipes rugby à XV|ru Pau}}", "{{chemin équipes rugby à XV|ru Vannes}}"]);
  assert.deepEqual(table.rows[0], { name: "{{chemin équipes rugby à XV|ru Toulouse}}", w: 7, d: 0, l: 2, pf: 277, pa: 209, bonus: 4, pts: 32 });
  assert.equal(table.rows[1].pts, 24 + 2 + 2 - 2, "a penalty comes off the total");
  assert.equal(table.rows[2].pts, 3, "the editors' own total");
  assert.deepEqual(tablesIn("{{Cls Rugby|p=1|club=ru Agen|v=1}}"), [], "lines without a heading are not a table");
});

test("a brace left open on a page costs nothing after it", () => {
  assert.deepEqual(calls("{{a|b}} {{broken [[x]] {{c|d}}"), ["a|b", "c|d"]);
  assert.equal(tablesIn(`{{cite web |title=Oops ${SPORTS_TABLE}`)[0].rows.length, 3);
});

test("a side's name is the link a cell shows, past its flag", () => {
  assert.deepEqual(linkOf('<span class="flagicon">[[File:Flag of France.svg|23x15px|border |alt=|link=]]&nbsp;</span>[[France national rugby union team|France]]'),
    { target: "France national rugby union team", label: "France" });
  assert.deepEqual(linkOf("[[Racing 92]]"), { target: "Racing 92", label: "Racing 92" });
  assert.deepEqual(linkOf("''A déterminer''"), { label: "A déterminer" });
});

test("English Wikipedia writes a season its own way", () => {
  assert.equal(years("2026-2027"), "2026–27");
  assert.equal(years("2027"), "2027");
});

// TheSportsDB's season games, as `eventsseason.php` has them.
const game = (round, home, away, status = "FT", id = `${round}${home}`) => ({
  idEvent: id, intRound: String(round), strHomeTeam: home, strAwayTeam: away, strStatus: status,
  strHomeTeamBadge: `https://r2.example/${home}.png`, strAwayTeamBadge: `https://r2.example/${away}.png`,
  dateEvent: "2026-11-07", strTimestamp: "2026-11-07T13:30:00",
});

test("each row is the side our fixtures name, the same name before a close one", () => {
  const sides = sidesOf([game(1, "Bulls", "Newcastle Red Bulls Rugby"), game(1, "ASM Clermont Auvergne", "Racing Métro 92")]);
  assert.deepEqual(sides.map((s) => s.name), ["Bulls", "Newcastle Red Bulls", "Clermont Auvergne", "Racing 92"], "the names our fixtures show");
  const rows = [
    { label: "Newcastle Red Bulls", target: "Newcastle Red Bulls" },
    { label: "Bulls", target: "Bulls (rugby union)" },
    { label: "ASM Clermont", target: "ASM Clermont Auvergne" },
    { label: "Racing 92" },
    { label: "Lions", target: "Lions (United Rugby Championship)" },
  ];
  const found = matchSides(rows, sides);
  assert.deepEqual(rows.map((r) => found.get(r)?.name), ["Newcastle Red Bulls", "Bulls", "Clermont Auvergne", "Racing 92", undefined]);
  const twins = [{ label: "Stade" }];
  assert.equal(matchSides(twins, sidesOf([game(1, "Stade Toulousain", "Stade Rochelais")])).size, 0, "two that fit as well are no match");
});

test("a game counts as played in the table's rounds, ended by the feed or by API-Sports", () => {
  const games = [game(1, "A", "B"), game(2, "A", "C", "NS", "late"), game(2, "B", "C", "NS"), game(16, "A", "B"), game(150, "A", "C")];
  assert.equal(finishedIn(games, [1, 4]), 1, "not the round of 16, not the semi-finals");
  assert.equal(finishedIn(games, [1, 4], { "rugby:tsdb:late": { state: "final" } }), 2, "the score API-Sports gave for a game the feed still has to come");
});

test("our table: the sides' names and crests, the zones, and the games it still lacks", () => {
  const row = (label, w, d, l, bonus, pts) => ({ label, w, d, l, pf: 100 + w, pa: 100, bonus, pts });
  const north = { id: "north", rows: [row("France", 3, 0, 1, 5, 17), row("Italy", 0, 0, 4, 0, 0)] };
  const south = { id: "south", rows: [row("South Africa", 4, 0, 0, 4, 20), row("Fiji", 0, 0, 4, 0, 0)] };
  const sides = sidesOf([game(1, "France Rugby", "Fiji Rugby"), game(1, "Italy Rugby", "South Africa Rugby")]);
  const zones = [{ from: 1, to: 1, key: "r16", line: "solid" }];
  const out = standingsFrom({ tables: [north, south], sides, finished: 9, source: { zones }, title: "2026 Nations Championship", lang: "en" });
  assert.deepEqual(out.tables[0].columns, ["p", "w", "d", "l", "pd", "bp", "pts"]);
  assert.deepEqual(out.tables[0].rows[0], { pos: 1, name: "France", logo: "https://r2.example/France Rugby.png", cells: ["4", "3", "0", "1", "+3", "5", "17"], value: 17 });
  assert.deepEqual(out.tables[1].lines, [{ after: 1, line: "solid" }]);
  assert.deepEqual(out.source, {
    site: "wikipedia", title: "2026 Nations Championship", url: "https://en.wikipedia.org/wiki/2026_Nations_Championship",
    license: "CC BY-SA 4.0", missing: 1,
  }, "sixteen played across the rows are eight games; the feed has seen nine");
});

/** What Wikipedia expands those names to (checked 2026-11-09). */
const EXPANDED = {
  "{{chemin équipes rugby à XV|ru Toulouse}}": "[[Stade toulousain]]",
  "{{chemin équipes rugby à XV|ru Pau}}": "[[Section paloise (rugby à XV)|Section paloise]]",
  "{{chemin équipes rugby à XV|ru Vannes}}": "[[Rugby club vannetais|RC Vannes]]",
  "{{nowrap|[[Northampton Saints]]}}": '<span class="nowrap">[[Northampton Saints]]</span>',
};

/** Wikipedia as the tables need it: pages by language, names expanded, both counted. */
function fakeWiki(pages) {
  const asked = { pages: [], expanded: [] };
  return {
    asked,
    async pages(lang, titles) {
      asked.pages.push(`${lang}:${titles.join("|")}`);
      return new Map(titles.filter((t) => pages[t]).map((t) => [t, { title: t, content: pages[t] }]));
    },
    async expand(lang, title, pieces) {
      asked.expanded.push(...pieces);
      return pieces.map((p) => EXPANDED[p] ?? p);
    },
  };
}

test("every competition's table in one request per Wikipedia, each name expanded once", async () => {
  const wiki = fakeWiki({
    "Championnat de France de rugby à XV 2026-2027": CLS_RUGBY,
    "2026–27 Premiership Rugby": SPORTS_TABLE,
    "2027 Six Nations Championship": "{{#invoke:sports table|main|style=Rugby|team1=ENG|name_ENG=England|win_ENG=0}}",
  });
  const games = {
    4430: [game(1, "Stade Toulousain", "Section Paloise")],
    4414: [game(1, "Leicester Tigers", "Gloucester Rugby"), game(2, "Northampton Saints", "Leicester Tigers", "AET")],
  };
  const seasons = { 4430: "2026-2027", 4414: "2026-2027", 4714: "2027", 4550: undefined };
  const leagues = [4430, 4550, 4414, 4714, 4391].map((id) => ({ id }));
  const tables = rugbyTables({ wiki, leagues, seasonOf: (id) => seasons[id], seasonGames: async (id) => games[id] ?? [], now: () => Date.parse("2026-11-09T12:00:00Z") });

  const out = await tables();
  assert.deepEqual(Object.keys(out), ["4414", "4430"], "a competition nobody has played in yet, or whose season is not known, has none");
  assert.deepEqual(wiki.asked.pages, ["fr:Championnat de France de rugby à XV 2026-2027", "en:2026–27 Premiership Rugby|2027 Six Nations Championship"]);
  assert.deepEqual(out[4430].tables[0].rows.map((r) => [r.name, r.logo !== undefined]), [["Stade Toulousain", true], ["Section Paloise", true], ["RC Vannes", false]],
    "a side the feed has no game for keeps Wikipedia's name, and has no crest");
  assert.equal(out[4430].tables[0].legend?.[0]?.key, "semifinals");
  assert.equal(out[4414].source.missing, 0, "the feed's two games are well inside the table's seven");
  assert.equal(out[4414].tables[0].rows[1].name, "Northampton Saints");

  const expanded = wiki.asked.expanded.length;
  await tables(new Set(["4430"]));
  assert.equal(wiki.asked.expanded.length, expanded, "names are expanded once for good");
  assert.equal(wiki.asked.pages.at(-1), "fr:Championnat de France de rugby à XV 2026-2027", "after a game, only that competition's page");
});

test("a cup's pools are read from their own pages, which the credit lists; one Wikipedia down costs the other nothing", async () => {
  const pool = (n) => [`Template:2026–27 European Rugby Champions Cup Pool ${n} table`, SPORTS_TABLE];
  const wiki = fakeWiki(Object.fromEntries([1, 2, 3, 4].map(pool)));
  const down = { ...wiki, pages: async (lang, titles) => (lang === "fr" ? Promise.reject(new Error("maxlag")) : wiki.pages(lang, titles)) };
  const tables = rugbyTables({ wiki: down, leagues: [{ id: 4430 }, { id: 4550 }], seasonOf: () => "2026-2027", seasonGames: async () => [] });
  const out = await tables();
  assert.deepEqual(Object.keys(out), ["4550"], "the Top 14 waits for French Wikipedia; the Champions Cup does not");
  assert.deepEqual(out[4550].tables.map((t) => t.id), ["pool-1", "pool-2", "pool-3", "pool-4"]);
  assert.equal(out[4550].source.title, "2026–27 European Rugby Champions Cup", "the article that shows them");
  assert.equal(out[4550].source.pages.length, 4, "and the four pages they were read from");
});

test("a competition that fails keeps its last table and costs the others nothing", async () => {
  const wiki = fakeWiki({ "2026–27 Premiership Rugby": SPORTS_TABLE, "Championnat de France de rugby à XV 2026-2027": CLS_RUGBY });
  const seen = [];
  const tables = rugbyTables({
    wiki, leagues: [{ id: 4430 }, { id: 4414 }], seasonOf: () => "2026-2027", log: (m) => seen.push(m),
    seasonGames: async (id) => { if (id === 4430) throw new Error("HTTP 429"); return []; },
  });
  const out = await tables();
  assert.deepEqual(Object.keys(out), ["4414"]);
  assert.ok(seen.some((m) => m.includes("4430") && m.includes("HTTP 429")));
});

test("a complete table nobody plays in this week is looked at daily, and a season's games are kept six hours", async () => {
  const H = 3600e3;
  let t = Date.parse("2026-11-09T12:00:00Z");
  const run = (resting, games = []) => {
    const wiki = fakeWiki({ "2026–27 Premiership Rugby": SPORTS_TABLE });
    const seasons = [];
    const tables = rugbyTables({ wiki, leagues: [{ id: 4414 }], seasonOf: () => "2026-2027", resting: () => resting, now: () => t, seasonGames: async (id) => (seasons.push(id), games) });
    return { tables, pages: wiki.asked.pages, seasons };
  };

  // Nine games played to the table's seven: the volunteers have yet to catch up.
  const behind = run(true, Array.from({ length: 9 }, (_, i) => game(1, `H${i}`, `A${i}`)));
  await behind.tables();
  t += H;
  await behind.tables();
  assert.equal(behind.pages.length, 2, "a table still missing games is looked at every hour, resting or not");

  const resting = run(true);
  const first = await resting.tables();
  t += H;
  const later = await resting.tables();
  assert.equal(resting.pages.length, 1, "an hour on, a resting table is not asked again");
  assert.equal(later[4414], first[4414], "and is given as last read, not as missing");
  await resting.tables(new Set(["4414"]));
  assert.equal(resting.pages.length, 2, "a final whistle in it is asked about at once");
  t += 24 * H;
  await resting.tables();
  assert.equal(resting.pages.length, 3, "and a day on");

  const playing = run(false);
  await playing.tables();
  t += H;
  await playing.tables();
  assert.deepEqual([playing.pages.length, playing.seasons.length], [2, 1], "every hour its page, its season kept");
  await playing.tables(new Set(["4414"]));
  assert.equal(playing.seasons.length, 2, "a final whistle asks for the season again");
  t += 6 * H;
  await playing.tables();
  assert.equal(playing.seasons.length, 3, "and so do six hours");
});
