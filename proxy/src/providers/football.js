import { dailyAndLive } from "./apisports.js";
import { STATE, team } from "../model.js";

const BASE = "https://v3.football.api-sports.io";
const LIVE = new Set(["1H", "2H", "HT", "ET", "BT", "P", "LIVE", "INT", "SUSP"]);
const FINAL = new Set(["FT", "AET", "PEN"]);

export function normaliseFixture(f, league) {
  const s = f.fixture.status;
  let state = STATE.other;
  if (["NS", "TBD"].includes(s.short)) state = STATE.scheduled;
  else if (LIVE.has(s.short)) state = STATE.live;
  else if (FINAL.has(s.short)) state = STATE.final;
  const clock = state === STATE.live && s.elapsed != null && !["HT", "BT", "P"].includes(s.short)
    ? `${s.elapsed}${s.extra ? "+" + s.extra : ""}'`
    : undefined;
  const detail = detailFor(s.short);
  return {
    id: `football:${f.fixture.id}`,
    sport: "football",
    league: { id: league.id, name: league.name, short: league.short },
    kind: "match",
    start: new Date(f.fixture.date).toISOString(),
    round: f.league.round,
    status: { state, clock, detail },
    home: team(f.teams.home.name, undefined, { logo: f.teams.home.logo }),
    away: team(f.teams.away.name, undefined, { logo: f.teams.away.logo }),
    score: { home: f.goals.home, away: f.goals.away },
  };
}

function detailFor(short) {
  return {
    HT: "Half-time", ET: "Extra time", BT: "Break", P: "Penalties", SUSP: "Suspended", INT: "Interrupted",
    AET: "After extra time", PEN: "After penalties", PST: "Postponed", CANC: "Cancelled", ABD: "Abandoned",
    AWD: "Awarded", WO: "Walkover", TBD: "Time TBD",
  }[short];
}

export function footballProvider(client, leagues) {
  const byId = new Map(leagues.map((l) => [l.id, l]));
  const keep = (rows) => rows.filter((f) => byId.has(f.league.id)).map((f) => normaliseFixture(f, byId.get(f.league.id)));
  return dailyAndLive({ sport: "football", client, base: BASE, path: "/fixtures", keep });
}
