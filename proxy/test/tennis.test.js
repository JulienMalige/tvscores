import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normaliseMatch, liveClock, setsLine } from "../src/providers/livetennis.js";

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
