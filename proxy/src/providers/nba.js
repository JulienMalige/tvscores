import { STATE, team } from "../model.js";

const BASE = "https://v2.nba.api-sports.io";

export function normaliseGame(g, league) {
  const s = g.status;
  // status.short: 1 scheduled, 2 in play, 3 finished
  let state = STATE.other;
  if (s.short === 1) state = STATE.scheduled;
  else if (s.short === 2) state = STATE.live;
  else if (s.short === 3) state = STATE.final;
  const period = g.periods?.current;
  const halftime = s.halftime === true;
  const clock = state === STATE.live && !halftime && period ? `${ordinal(period)} ${s.clock ?? ""}`.trim() : undefined;
  return {
    id: `nba:${g.id}`,
    sport: "nba",
    league: { id: league.id, name: league.name, short: league.short },
    kind: "match",
    start: new Date(g.date.start).toISOString(),
    round: g.stage != null ? `Stage ${g.stage}` : undefined,
    status: { state, clock, detail: halftime ? "Half-time" : undefined },
    home: team(g.teams.home.name, g.teams.home.code, { nick: true }),
    away: team(g.teams.visitors.name, g.teams.visitors.code, { nick: true }),
    score: { home: g.scores.home.points, away: g.scores.visitors.points },
  };
}

function ordinal(n) {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : n === 4 ? "4th" : `OT${n - 4}`;
}

export function nbaProvider(client, leagues) {
  const byId = new Map(leagues.map((l) => [l.id, l]));
  const keep = (rows) => rows.filter((g) => byId.has(g.league)).map((g) => normaliseGame(g, byId.get(g.league)));
  return {
    sport: "nba",
    async byDate(date) {
      return keep(await client.get(BASE, "/games", { date }));
    },
    async live() {
      return keep(await client.get(BASE, "/games", { live: "all" }));
    },
  };
}
