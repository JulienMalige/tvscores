import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { config } from "../src/config.js";
import { roundOf, tiersFor, normaliseMatch, liveClock, setsLine, bigEventFilter, tierLabel, TIER_CATEGORY } from "../src/providers/livetennis.js";
import { calendarEntry } from "../src/providers/tennis-calendar.js";

const raw = JSON.parse(readFileSync(new URL("./fixtures/tennis.json", import.meta.url))).data[0];

test("live ATP singles match: sets as score, current set as clock, round as caption, not detail", () => {
  const e = normaliseMatch(raw);
  assert.equal(e.sport, "tennis");
  assert.equal(e.league.short, "ATP");
  assert.equal(e.status.state, "live");
  assert.deepEqual([e.score.home, e.score.away], raw.score.sets);
  // games [[7, 5, 0], [6, 7, 0]] is 7-6, 5-7, then a third set just started,
  // which matches the fixture's own sets total of one apiece.
  assert.equal(e.status.clock, "Set 3 · 0-0");
  assert.equal(e.status.detail, undefined, "the round is the caption over the row");
  assert.equal(e.round, roundOf(raw.round));
  assert.equal(e.home.nick, "Fenty");
  assert.equal(e.home.short, "FEN");
  assert.ok(e.start.endsWith("Z"));
});

test("a final we never saw played reports no score rather than 0-0", () => {
  const ghost = normaliseMatch({ ...raw, status: "completed", score: { sets: [0, 0], games: [[], []] } });
  assert.equal(ghost.status.state, "final");
  assert.deepEqual([ghost.score.home, ghost.score.away], [null, null]);
  const played = normaliseMatch({ ...raw, status: "completed" });
  assert.equal(played.status.detail, "7-6 5-7 0-0");
  assert.deepEqual([played.score.home, played.score.away], raw.score.sets);
});

test("doubles and unknown tours are dropped", () => {
  assert.equal(normaliseMatch({ ...raw, is_doubles: true }), null);
  assert.equal(normaliseMatch({ ...raw, tour: "challenger" }), null);
  assert.equal(normaliseMatch({ ...raw, tour: null }), null);
});

test("upcoming and interrupted states", () => {
  const up = normaliseMatch({ ...raw, status: "upcoming", score: null });
  assert.equal(up.status.state, "scheduled");
  assert.equal(up.score.home, null);
  const paused = normaliseMatch({ ...raw, event_status: "Interrupted" });
  assert.equal(paused.status.clock, undefined);
  assert.equal(paused.status.detail, undefined);
  assert.equal(paused.status.note, "Interrupted");
});

test("helpers", () => {
  // Shape taken from the live feed: one array per player, one entry per set.
  assert.equal(liveClock({ games: [[6, 5, 6], [4, 7, 5]] }), "Set 3 · 6-5");
  assert.equal(setsLine({ games: [[6, 5, 6], [4, 7, 5]] }), "6-4 5-7 6-5");
  // A set can be half entered; the missing side reads as zero, never undefined.
  assert.equal(liveClock({ games: [[6, 5], [4]] }), "Set 2 · 5-0");
  assert.equal(liveClock({ games: [[], []] }), undefined);
  assert.equal(liveClock({ games: [] }), undefined);
  assert.equal(liveClock(null), undefined);
  assert.equal(setsLine(null), undefined);
});

const CATALOGUE = { 1238: "grand_slam", 1270: "itf", 2129: null, 3226: "atp_250", 7001: "masters_1000", 8002: "wta_1000", 9003: "challenger", 9004: "itf", 1652: "atp_500", 5005: "wta_500", 5006: "wta_250" };
const big = (over = {}) =>
  bigEventFilter({ byId: CATALOGUE, categories: config.tennis.categories, includeQualifying: false, alsoBig: [1270], ...over });

test("only the majors, the 1000s, the 500s and the finals reach the television", () => {
  const keep = big();
  assert.equal(keep({ tournament_id: 1238 }), true, "Australian Open");
  assert.equal(keep({ tournament_id: 7001 }), true, "a Masters 1000");
  assert.equal(keep({ tournament_id: 8002 }), true, "a WTA 1000");
  assert.equal(keep({ tournament_id: 1652 }), true, "an ATP 500, Beijing");
  assert.equal(keep({ tournament_id: 5005 }), true, "a WTA 500");
  assert.equal(keep({ tournament_id: 3226 }), false, "an ATP 250");
  assert.equal(keep({ tournament_id: 5006 }), false, "a WTA 250");
  assert.equal(keep({ tournament_id: 9003 }), false, "a Challenger");
  assert.equal(keep({ tournament_id: 9004 }), false, "an ITF");
});

test("a tournament the feed could not label is dropped, not guessed at", () => {
  // The provider documents `category` as null wherever its catalogues do not
  // agree on an exact name, and says it never derives one from the name.
  assert.equal(big()({ tournament_id: 2129 }), false);
  assert.equal(big()({ tournament_id: 404404 }), false, "and an id we have never seen");
});

test("qualifying is the same tournament but not the part you watch", () => {
  assert.equal(big()({ tournament_id: 1238, is_qualifying: true }), false);
  assert.equal(big({ includeQualifying: true })({ tournament_id: 1238, is_qualifying: true }), true);
});

test("a 1000 their catalogue mislabels is pinned by id", () => {
  // Rome comes back as `itf`, because Rome also hosts an ITF week of that name.
  const keep = big();
  assert.equal(CATALOGUE[1270], "itf", "the catalogue really does say itf");
  assert.equal(keep({ tournament_id: 1270 }), true, "and we show it anyway");
  assert.equal(keep({ tournament_id: 9004 }), false, "without letting every itf through");
  assert.equal(keep({ tournament_id: 1270, is_qualifying: true }), false, "qualifying stays out even when pinned");
});

test("a match carries its tournament: name, flag, tier and surface from the catalogue", () => {
  const e = normaliseMatch(raw, { name: "Beijing", city: "Beijing", country: "CN", tier: "wta_1000", surface: "hard" });
  assert.deepEqual(e.competition, { name: "Beijing", city: "Beijing", country: "CN", flag: "🇨🇳", tier: "WTA 1000", surface: "hard", start: undefined, end: undefined });
  assert.equal(normaliseMatch(raw).competition, undefined, "no catalogue entry, no heading");
  assert.equal(tierLabel("grand_slam"), "Grand Slam");
  assert.equal(tierLabel("atp_1000"), "ATP 1000");
  assert.equal(tierLabel(null), undefined);
  assert.equal(tierLabel("wta__500_"), "WTA 500", "an odd label is tidied, not a crash that loses every match");
});

test("a tournament with a tier and no category still counts by its tier", () => {
  // Beijing, 2026-09-28: category null, tier wta_1000.
  assert.equal(TIER_CATEGORY.wta_1000, "wta_1000");
  assert.equal(TIER_CATEGORY.atp_1000, "masters_1000", "the ATP's 1000s are the Masters");
  assert.equal(TIER_CATEGORY.atp_500, "atp_500", "a 500 is kept by its tier too");
  assert.equal(TIER_CATEGORY.wta_500, "wta_500");
  assert.equal(TIER_CATEGORY.atp_250, undefined, "a 250 stays out");
  for (const tier of Object.keys(TIER_CATEGORY).filter((t) => t !== "tour_finals")) {
    assert.ok(config.tennis.categories.includes(TIER_CATEGORY[tier]), `${tier} stands for a category we show`);
  }
});

test("upcoming asks for our tiers only, and rounds lose the tournament's name", () => {
  assert.deepEqual(tiersFor(["grand_slam", "masters_1000", "tour_finals", "wta_1000"]).sort(),
    ["atp_1000", "atp_finals", "grand_slam", "wta_1000", "wta_finals"]);
  assert.deepEqual(tiersFor(config.tennis.categories).sort(),
    ["atp_1000", "atp_500", "atp_finals", "grand_slam", "wta_1000", "wta_500", "wta_finals"], "the 500s are asked for");
  assert.ok(!tiersFor(config.tennis.categories).includes("tour_finals"), "never our own name, which the feed refuses");
  assert.equal(roundOf("WTA Beijing - Round of 64"), "Round of 64");
  assert.equal(roundOf("WTA Beijing - 1/64-finals"), "Round of 128");
  assert.equal(roundOf("1/8-finals"), "Round of 16");
  assert.equal(roundOf("1/4-finals"), "Quarter-final");
  assert.equal(roundOf("1/2-final"), "Semi-final");
  assert.equal(roundOf("Final"), "Final");
  assert.equal(roundOf(undefined), undefined);
});

// A slice of proxy/tennis-calendar.json's shape: the Beijing fortnight, where
// both tours are in town with different weeks, and Tokyo the same week.
const CALENDAR = [
  { tour: "wta", name: "China Open", city: "Beijing", country: "CN", start: "2026-09-24", end: "2026-10-04", tier: "wta_1000" },
  { tour: "atp", name: "China Open", city: "Beijing", country: "CN", start: "2026-09-24", end: "2026-09-30", tier: "atp_500" },
  { tour: "atp", name: "Japan Open", city: "Tokyo", country: "JP", start: "2026-09-24", end: "2026-09-30", tier: "atp_500" },
  { tour: "atp", name: "Shanghai Masters", city: "Shanghai", country: "CN", start: "2026-10-01", end: "2026-10-12", tier: "masters_1000" },
  { tour: "wta", name: "Wuhan Open", city: "Wuhan", country: "CN", start: "2026-10-05", end: "2026-10-11", tier: "wta_1000" },
];
const BEIJING_WTA = { name: "Beijing", city: "Beijing", country: "CN", tier: "wta_1000", surface: "hard" };

test("a catalogue tournament finds its calendar entry by tour, town and week", () => {
  assert.equal(calendarEntry(CALENDAR, { tour: "wta", info: BEIJING_WTA, day: "2026-09-28" })?.name, "China Open");
  assert.equal(calendarEntry(CALENDAR, { tour: "wta", info: BEIJING_WTA, day: "2026-09-28" })?.end, "2026-10-04", "the WTA's fortnight, not the ATP's week");
  assert.equal(calendarEntry(CALENDAR, { tour: "atp", info: { name: "Tokyo", city: "Tokyo", country: "JP" }, day: "2026-09-26" })?.name, "Japan Open");
  assert.equal(calendarEntry(CALENDAR, { tour: "wta", info: { name: "Tokyo", city: "Tokyo", country: "JP" }, day: "2026-09-26" }), undefined, "no WTA Tokyo that week");
  // Qualifying, and a Beijing evening that is still the day before in UTC.
  assert.equal(calendarEntry(CALENDAR, { tour: "wta", info: BEIJING_WTA, day: "2026-09-21" })?.name, "China Open");
  assert.equal(calendarEntry(CALENDAR, { tour: "wta", info: BEIJING_WTA, day: "2026-09-20" }), undefined, "but not a week early");
  assert.equal(calendarEntry(CALENDAR, { tour: "wta", info: BEIJING_WTA, day: "2027-09-28" }), undefined, "nor next year's");
});

test("the calendar join survives what the feed leaves out", () => {
  // No city: the name is often the town.
  assert.equal(calendarEntry(CALENDAR, { tour: "atp", info: { name: "Shanghai", country: "CN" }, day: "2026-10-05" })?.name, "Shanghai Masters");
  // An accent or a capital more or less still joins.
  assert.equal(calendarEntry(CALENDAR, { tour: "atp", info: { name: "x", city: "  shanghaí " }, day: "2026-10-05" })?.name, "Shanghai Masters");
  // No town at all: the country, when a single entry of that tour is on there.
  assert.equal(calendarEntry(CALENDAR, { tour: "atp", info: { name: "ATP 500", country: "jp" }, day: "2026-09-26" })?.name, "Japan Open");
  assert.equal(calendarEntry(CALENDAR, { tour: "atp", info: { name: "ATP event", country: "CN" }, day: "2026-09-30" }), undefined, "two in China that week: neither is guessed");
  assert.equal(calendarEntry(CALENDAR, { tour: "atp", info: {}, day: "2026-09-26" }), undefined);
  assert.equal(calendarEntry(CALENDAR, { tour: "atp", info: BEIJING_WTA, day: undefined }), undefined);
  assert.equal(calendarEntry(undefined, { tour: "wta", info: BEIJING_WTA, day: "2026-09-28" }), undefined);
  assert.equal(calendarEntry([null, { tour: "wta", city: "Beijing" }], { tour: "wta", info: BEIJING_WTA, day: "2026-09-28" }), undefined, "an entry without dates is skipped");
});

test("a match's competition carries the calendar's name and dates, else the feed's name", () => {
  const match = { ...raw, tour: "wta", scheduled_time: "2026-09-28T06:00:00Z" };
  assert.deepEqual(normaliseMatch(match, BEIJING_WTA, CALENDAR).competition,
    { name: "China Open", city: "Beijing", country: "CN", flag: "🇨🇳", tier: "WTA 1000", surface: "hard", start: "2026-09-24", end: "2026-10-04" });
  const unknown = normaliseMatch({ ...match, tour: "atp" }, { name: "Tiburon", city: "Tiburon", country: "US", tier: null }, CALENDAR).competition;
  assert.equal(unknown.name, "Tiburon");
  assert.equal(unknown.start, undefined);
  assert.equal(unknown.end, undefined);
  // A catalogue entry with no tier borrows the calendar's.
  assert.equal(normaliseMatch(match, { ...BEIJING_WTA, tier: null }, CALENDAR).competition.tier, "WTA 1000");
});

test("the calendar file is well formed: every entry joinable, dated, and in order", () => {
  const file = JSON.parse(readFileSync(new URL("../tennis-calendar.json", import.meta.url)));
  assert.ok(file.length > 0);
  assert.deepEqual(config.tennis.calendar, file, "config reads the same file");
  const tiers = new Set(["grand_slam", "masters_1000", "atp_500", "wta_1000", "wta_500", "tour_finals"]);
  for (const c of file) {
    const what = `${c.tour} ${c.name} ${c.start}`;
    assert.ok(["atp", "wta"].includes(c.tour), what);
    assert.ok(c.name && c.city, what);
    assert.match(c.country, /^[A-Z]{2}$/, what);
    assert.match(c.start, /^\d{4}-\d{2}-\d{2}$/, what);
    assert.match(c.end, /^\d{4}-\d{2}-\d{2}$/, what);
    assert.ok(!Number.isNaN(Date.parse(c.start)) && !Number.isNaN(Date.parse(c.end)), what);
    assert.ok(c.start <= c.end, `${what} ends after it starts`);
    assert.ok(Date.parse(c.end) - Date.parse(c.start) <= 21 * 86400e3, `${what} lasts three weeks at most`);
    assert.ok(tiers.has(c.tier), `${what} has a tier we show`);
  }
  // Two entries of one tour in one town cannot overlap, or the join would pick either.
  for (const a of file) for (const b of file) {
    if (a !== b && a.tour === b.tour && a.city === b.city) assert.ok(a.end < b.start || b.end < a.start, `${a.tour} ${a.city} ${a.start} and ${b.start}`);
  }
});
