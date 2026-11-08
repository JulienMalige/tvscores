import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { config } from "../src/config.js";
import { untieredOn, normaliseMatch, doublesOnly } from "../src/providers/livetennis-match.js";
import { catalogued } from "../src/providers/livetennis.js";
import { calendarEntry } from "../src/providers/tennis-calendar.js";

const raw = JSON.parse(readFileSync(new URL("./fixtures/tennis.json", import.meta.url))).data[0];

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

test("a pinned tournament with no tier is asked for by id only in its week", () => {
  const info = { 1667: { name: "Shanghai", city: "Shanghai", country: "CN", tier: null }, 1269: { name: "Madrid", city: "Madrid", country: "ES", tier: "atp_1000" } };
  const calendar = [{ tour: "atp", name: "Shanghai Masters", city: "Shanghai", country: "CN", start: "2026-10-07", end: "2026-10-18", tier: "atp_1000" }];
  assert.deepEqual(untieredOn([1667, 1269], info, calendar, "2026-10-10"), ["1667"], "Shanghai in its week; Madrid has a tier");
  assert.deepEqual(untieredOn([1667], info, calendar, "2026-11-20"), [], "not outside it");
});

// The season finals as the feed had them on 2026-11-08: the WTA's, moved to
// Indian Wells for 2026, still named after Riyadh, their host in 2024 and
// 2025, and with no tier, so the upcoming list's tier filter never sees them.
const finals = JSON.parse(readFileSync(new URL("./fixtures/tennis-finals.json", import.meta.url))).data;
const FINALS = [
  { tour: "wta", name: "WTA Finals", city: "Indian Wells", country: "US", start: "2026-11-08", end: "2026-11-15", tier: "tour_finals" },
  { tour: "atp", name: "ATP Finals", city: "Turin", country: "IT", start: "2026-11-15", end: "2026-11-22", tier: "tour_finals" },
];
const FINALS_INFO = {
  2794: { name: "Finals - Turin", city: null, country: null, tier: null, surface: "hard", tour: "atp", category: "tour_finals" },
  3190: { name: "Finals - Riyadh", city: null, country: null, tier: null, surface: "hard", tour: "wta", category: "tour_finals" },
  3195: { name: "Finals - Riyadh", city: null, country: null, tier: null, surface: "hard", tour: "wta", category: "tour_finals" },
};

test("the catalogue keeps each tournament's tour and category, as the feed gives them", () => {
  const record = { category: "tour_finals", city: null, country: null, gender: "women", id: "3195", indoor: true, name: "Finals - Riyadh", surface: "hard", tier: null, tier_source: null, tour: "wta" };
  assert.deepEqual(catalogued(record, "wta"), FINALS_INFO[3195]);
  assert.equal(catalogued({ ...record, category: null, tier: "wta_1000" }, "wta").category, "wta_1000", "a tier stands for its category");
  assert.equal(catalogued({ ...record, category: null }, "wta").category, null, "and nothing is guessed from the name");
});

test("the season finals join our calendar wherever the feed says they are played", () => {
  assert.equal(calendarEntry(FINALS, { tour: "wta", info: FINALS_INFO[3195], day: "2026-11-08" })?.city, "Indian Wells");
  assert.equal(calendarEntry(FINALS, { tour: "atp", info: FINALS_INFO[2794], day: "2026-11-18" })?.name, "ATP Finals");
  assert.equal(calendarEntry(FINALS, { tour: "wta", info: FINALS_INFO[3195], day: "2026-11-25" }), undefined, "not after their week");
  assert.equal(calendarEntry(FINALS, { tour: "wta", info: { ...FINALS_INFO[3195], category: null }, day: "2026-11-08" }), undefined, "a tournament not known as the finals keeps the town join");
});

test("the season finals are asked for by id in their week, and a doubles draw only until it is known", () => {
  assert.deepEqual(untieredOn([], FINALS_INFO, FINALS, "2026-11-08"), ["3190", "3195"], "the WTA's, not yet the ATP's");
  assert.deepEqual(untieredOn([], FINALS_INFO, FINALS, "2026-11-08", ["3190"]), ["3195"], "its doubles draw is known");
  assert.deepEqual(untieredOn([], FINALS_INFO, FINALS, "2026-11-14"), ["2794", "3190", "3195"], "the two weeks meet");
  assert.deepEqual(untieredOn([], FINALS_INFO, FINALS, "2026-12-01"), []);
  assert.deepEqual(untieredOn([3195], FINALS_INFO, FINALS, "2026-11-08"), ["3195", "3190"], "pinned or not, asked for once");
  assert.equal(doublesOnly([finals[2]]), true);
  assert.equal(doublesOnly(finals), false);
  assert.equal(doublesOnly([]), false, "an empty answer says nothing about the draw");
});

test("a finals match is headed by our calendar's name and town, not the feed's host", () => {
  const [, gauff, doubles] = finals;
  const m = normaliseMatch(gauff, FINALS_INFO[3195], FINALS);
  assert.equal(m.status.state, "scheduled");
  assert.equal(m.start, "2026-11-08T21:30:00.000Z");
  assert.equal(m.home.name, "Coco Gauff");
  assert.deepEqual(m.competition, { name: "WTA Finals", city: "Indian Wells", country: "US", flag: "🇺🇸", tier: "Tour Finals", surface: "hard", start: "2026-11-08", end: "2026-11-15" });
  assert.equal(normaliseMatch(doubles, FINALS_INFO[3190], FINALS), null, "doubles stay off the board");
});

// Rybakina withdrew on 2026-11-07: the feed called her three matches off by
// their event status, left them "upcoming", and listed Kostyuk's beside them.
test("a match the feed has called off says so, and is not shown as still to come", () => {
  const [rybakina] = finals;
  assert.equal(rybakina.status, "upcoming", "the feed's own status says nothing");
  const m = normaliseMatch(rybakina, FINALS_INFO[3195], FINALS);
  assert.equal(m.status.state, "other");
  assert.equal(m.status.detail, "Cancelled");
  assert.deepEqual([m.score.home, m.score.away], [null, null]);
  assert.equal(m.competition.name, "WTA Finals", "still under its tournament");
});
