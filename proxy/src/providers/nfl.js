import { STATE, team } from "../model.js";

const BASE = "https://v1.american-football.api-sports.io";
const LIVE = new Set(["Q1", "Q2", "Q3", "Q4", "OT", "HT"]);
const FINAL = new Set(["FT", "AOT"]);

export function normaliseGame(g, league) {
  const s = g.game.status;
  let state = STATE.other;
  if (s.short === "NS") state = STATE.scheduled;
  else if (LIVE.has(s.short)) state = STATE.live;
  else if (FINAL.has(s.short)) state = STATE.final;
  const period = { Q1: "1st", Q2: "2nd", Q3: "3rd", Q4: "4th", OT: "OT", HT: "Half-time" }[s.short];
  const clock = state === STATE.live && s.short !== "HT" ? [period, s.timer].filter(Boolean).join(" ") : undefined;
  const detail = s.short === "HT" ? "Half-time" : s.short === "AOT" ? "After overtime" : s.short === "PST" ? "Postponed" : s.short === "CANC" ? "Cancelled" : undefined;
  return {
    id: `nfl:${g.game.id}`,
    sport: "nfl",
    league: { id: league.id, name: league.name, short: league.short },
    kind: "match",
    start: new Date(g.game.date.timestamp * 1000).toISOString(),
    round: g.game.week,
    status: { state, clock, detail },
    home: team(g.teams.home.name, undefined, { nick: true, logo: g.teams.home.logo }),
    away: team(g.teams.away.name, undefined, { nick: true, logo: g.teams.away.logo }),
    score: { home: g.scores.home.total, away: g.scores.away.total },
  };
}

export function nflProvider(client, leagues) {
  const byId = new Map(leagues.map((l) => [l.id, l]));
  const keep = (rows) => rows.filter((g) => byId.has(g.league.id)).map((g) => normaliseGame(g, byId.get(g.league.id)));
  return {
    sport: "nfl",
    async byDate(date) {
      return keep(await client.get(BASE, "/games", { date }));
    },
    async live() {
      return keep(await client.get(BASE, "/games", { live: "all" }));
    },
  };
}
