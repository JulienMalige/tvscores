import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normaliseMatch, liveClock, setsLine, bigEventFilter, tierLabel, TIER_CATEGORY } from "../src/providers/livetennis.js";

const raw = JSON.parse(readFileSync(new URL("./fixtures/tennis.json", import.meta.url))).data[0];

test("live ATP singles match: sets as score, current set as clock, round as detail", () => {
  const e = normaliseMatch(raw);
  assert.equal(e.sport, "tennis");
  assert.equal(e.league.short, "ATP");
  assert.equal(e.status.state, "live");
  assert.deepEqual([e.score.home, e.score.away], raw.score.sets);
  // games [[7, 5, 0], [6, 7, 0]] is 7-6, 5-7, then a third set just started,
  // which matches the fixture's own sets total of one apiece.
  assert.equal(e.status.clock, "Set 3 · 0-0");
  assert.equal(e.status.detail, raw.round);
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
  assert.equal(paused.status.detail, raw.round);
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

const CATALOGUE = { 1238: "grand_slam", 1270: "itf", 2129: null, 3226: "atp_250", 7001: "masters_1000", 8002: "wta_1000", 9003: "challenger", 9004: "itf" };
const big = (over = {}) =>
  bigEventFilter({ byId: CATALOGUE, categories: ["grand_slam", "masters_1000", "tour_finals", "wta_1000"], includeQualifying: false, alsoBig: [1270], ...over });

test("only the majors, the 1000s and the finals reach the television", () => {
  const keep = big();
  assert.equal(keep({ tournament_id: 1238 }), true, "Australian Open");
  assert.equal(keep({ tournament_id: 7001 }), true, "a Masters 1000");
  assert.equal(keep({ tournament_id: 8002 }), true, "a WTA 1000");
  assert.equal(keep({ tournament_id: 3226 }), false, "an ATP 250");
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
  assert.deepEqual(e.competition, { name: "Beijing", city: "Beijing", flag: "🇨🇳", tier: "WTA 1000", surface: "hard" });
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
  assert.equal(TIER_CATEGORY.atp_500, undefined, "a 500 stays out");
});
