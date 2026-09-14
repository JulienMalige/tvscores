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
  assert.equal(e.status.clock, "Set 2 · 6-7");
  assert.equal(e.status.detail, raw.round);
  assert.equal(e.home.nick, "Fenty");
  assert.equal(e.home.short, "FEN");
  assert.ok(e.start.endsWith("Z"));
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
  assert.match(paused.status.detail, /Interrupted$/);
});

test("helpers", () => {
  assert.equal(liveClock({ games: [[7, 5, 0], [3, 2, 0]] }), "Set 2 · 3-2");
  assert.equal(setsLine({ games: [[7, 5, 0], [6, 7, 0]] }), "7-5 6-7");
  assert.equal(liveClock(null), undefined);
});
