import test from "node:test";
import assert from "node:assert/strict";
import { buildScoreboard, localDate } from "../src/scoreboard.js";

const ev = (id, start, sport = "football", state = "scheduled") => ({
  id, sport, kind: "match", start, status: { state }, league: { id: 2, name: "UCL", short: "UCL" },
});

test("buckets follow the viewer's time zone", () => {
  const now = Date.UTC(2026, 8, 13, 21, 30); // 23:30 Paris
  const events = [
    ev("a", "2026-09-13T23:30:00Z"), // 01:30 Paris on the 14th -> upcoming in Paris, today in UTC
    ev("b", "2026-09-13T19:00:00Z", "football", "live"),
    ev("c", "2026-09-12T19:00:00Z", "football", "final"),
    ev("e", "2026-09-13T20:25:00Z", "nfl", "live"), // started "yesterday" in Paris but still live -> today
    ev("d", "2026-09-20T13:00:00Z", "f1"),
  ];
  const paris = buildScoreboard(events, { tz: "Europe/Paris", now, sportOrder: ["football", "f1", "nfl"] });
  assert.deepEqual(paris.days.today.flatMap((g) => g.events.map((e) => e.id)), ["b", "e"]);
  assert.deepEqual(paris.days.yesterday.flatMap((g) => g.events.map((e) => e.id)), ["c"]);
  assert.deepEqual(paris.days.upcoming.flatMap((g) => g.events.map((e) => e.id)), ["a", "d"]);
  assert.equal(paris.live, 2);
  const utc = buildScoreboard(events, { tz: "UTC", now, sportOrder: ["football", "f1", "nfl"] });
  assert.deepEqual(utc.days.today.flatMap((g) => g.events.map((e) => e.id)), ["b", "a", "e"]);
});

test("league logo is attached from config at serve time", () => {
  const sb = buildScoreboard([ev("a", "2026-09-13T19:00:00Z", "football", "live")], {
    now: Date.UTC(2026, 8, 13, 20), leagues: { football: [{ id: 2, badge: "ucl" }] }, publicBase: "https://p/tvscores",
  });
  assert.equal(sb.days.today[0].league.logo, "https://p/tvscores/v1/assets/leagues/ucl.png");
});

test("stale is per sport", () => {
  const now = Date.UTC(2026, 8, 13, 12);
  const meta = { football: { lastOk: new Date(now - 3600e3).toISOString() }, nfl: { lastOk: new Date(now - 10 * 3600e3).toISOString() }, nba: {} };
  const sb = buildScoreboard([], { now, meta });
  assert.deepEqual(sb.stale, { football: false, nfl: true, nba: true });
});

test("localDate", () => {
  assert.equal(localDate("2026-09-13T23:30:00Z", "Europe/Paris"), "2026-09-14");
  assert.equal(localDate("2026-09-13T23:30:00Z", "America/New_York"), "2026-09-13");
});

const race = (sport, i) => ({ id: `${sport}${i}`, sport, kind: "race", start: new Date(Date.UTC(2026, 9, 1 + i)).toISOString(), status: { state: "scheduled" }, league: { id: sport, name: sport, short: sport } });

test("upcoming keeps ten rounds per racing series, not ten overall", () => {
  const events = [...Array(12)].flatMap((_, i) => [race("f1", i), race("motogp", i)]);
  const sb = buildScoreboard(events, { now: Date.UTC(2026, 8, 20), sportOrder: ["f1", "motogp"], upcomingDays: 90 });
  const counts = Object.fromEntries(sb.days.upcoming.map((g) => [g.sport, g.events.length]));
  assert.deepEqual(counts, { f1: 10, motogp: 10 });
});

test("upcoming stops at the end of the window", () => {
  const events = [...Array(12)].map((_, i) => race("f1", i));
  const now = Date.UTC(2026, 8, 28, 12); // 28 September, so the window ends on 5 October
  const sb = buildScoreboard(events, { now, sportOrder: ["f1"], upcomingDays: 7 });
  const days = sb.days.upcoming.flatMap((g) => g.events.map((e) => e.start.slice(0, 10)));
  assert.deepEqual(days, ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"]);
});

test("the window is counted in the viewer's own days", () => {
  // Midday UTC on 1 October is still 1 October in São Paulo (UTC-3), but the
  // viewer's "today" differs, and with it where the window ends.
  const kickoff = { id: "x", sport: "f1", kind: "race", start: "2026-10-01T12:00:00Z", status: { state: "scheduled" }, league: { id: "f1", name: "F1", short: "F1" } };
  const now = Date.UTC(2026, 8, 24, 2); // 24 September in UTC, 23:00 on the 23rd in São Paulo
  const count = (tz) => buildScoreboard([kickoff], { now, tz, upcomingDays: 7 }).days.upcoming.length;
  assert.equal(count("UTC"), 1, "seven days after 24 September");
  assert.equal(count("America/Sao_Paulo"), 0, "eight days after 23 September");
});
test("stale only covers sports with a scheduler this run", () => {
  const now = Date.UTC(2026, 8, 13, 12);
  const meta = { f1: { lastOk: new Date(now).toISOString() }, motogp: { lastOk: new Date(now - 10 * 3600e3).toISOString() } };
  assert.deepEqual(buildScoreboard([], { now, meta, activeSports: ["f1"] }).stale, { f1: false });
});

test("a competition with nothing this week says when it is next on", () => {
  const now = Date.UTC(2026, 8, 19, 12);
  const leagues = { nba: [{ id: 4387, name: "NBA", short: "NBA" }], f1: [{ id: "f1", name: "Formula 1", short: "F1" }], nfl: [{ id: 4391, name: "NFL", short: "NFL" }] };
  const race = { id: "f1:r", sport: "f1", kind: "race", league: { id: "f1", name: "Formula 1", short: "F1" }, start: "2026-09-26T11:00:00.000Z", status: { state: "scheduled" }, name: "Azerbaijan Grand Prix" };
  const game = { id: "nfl:g", sport: "nfl", kind: "match", league: { id: 4391, name: "NFL", short: "NFL" }, start: "2026-09-19T20:00:00.000Z", status: { state: "scheduled" }, home: { name: "A", short: "A" }, away: { name: "B", short: "B" }, score: {} };
  const sb = buildScoreboard([race, game], { now, leagues, upcomingDays: 3, meta: { nba: { next: { 4387: { start: "2026-10-21T23:30:00.000Z", season: "2026-2027" } } } } });
  const by = Object.fromEntries(sb.leagues.map((l) => [l.sport, l]));
  assert.deepEqual(by.nba.next, { start: "2026-10-21T23:30:00.000Z", season: "2026-2027" }, "what the daily pass learned");
  assert.deepEqual(by.f1.next, { start: "2026-09-26T11:00:00.000Z" }, "the calendar's next round, beyond the window");
  assert.equal(by.nfl.next, undefined, "a competition playing this week has no next to speak of");
});

test("a race weekend is on every day it has a session, the race on the last of them", () => {
  const weekend = {
    id: "motogp:austria", sport: "motogp", kind: "race", start: "2026-09-20T12:00:00Z", status: { state: "scheduled" },
    league: { id: "motogp", name: "MotoGP", short: "MotoGP" }, name: "Grand Prix of Austria",
    sessions: [
      { kind: "qualifying", name: "Qualifying", start: "2026-09-19T08:50:00Z" },
      { kind: "sprint", name: "Sprint", start: "2026-09-19T13:00:00Z" },
      { kind: "race", name: "Race", start: "2026-09-20T12:00:00Z" },
    ],
  };
  const on = (day) => buildScoreboard([weekend], { now: Date.UTC(2026, 8, day, 15), tz: "UTC", upcomingDays: 7 }).days;
  const saturday = on(19);
  assert.equal(saturday.today.length, 1, "Saturday: the sprint is today");
  assert.equal(saturday.upcoming.length, 1, "and the race is still to come");
  assert.equal(saturday.yesterday.length, 0);
  const sunday = on(20);
  assert.equal(sunday.today.length, 1, "Sunday: race day");
  assert.equal(sunday.yesterday.length, 1, "and the sprint was yesterday");
  assert.equal(sunday.upcoming.length, 0);
  const friday = on(18);
  assert.deepEqual([friday.yesterday.length, friday.today.length, friday.upcoming.length], [0, 0, 1], "Friday: the whole weekend is ahead, once");
});
