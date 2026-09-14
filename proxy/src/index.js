import { config } from "./config.js";
import { Store } from "./cache.js";
import { Quota } from "./quota.js";
import { ApiSports } from "./providers/apisports.js";
import { footballProvider } from "./providers/football.js";
import { nflProvider } from "./providers/nfl.js";
import { nbaProvider } from "./providers/nba.js";
import { f1Provider, f1Nationalities } from "./providers/jolpica.js";
import { motorsportProvider } from "./providers/ocblacktop.js";
import { tennisProvider } from "./providers/livetennis.js";
import { TeamSportScheduler, CalendarScheduler } from "./scheduler.js";
import { createApp } from "./server.js";
import { PhotoResolver } from "./photos.js";

const log = (msg) => console.log(`${new Date().toISOString()} ${msg}`);
const store = new Store(config.cacheDir);

const schedulers = [];
for (const [sport, make] of [
  ["football", footballProvider],
  ["nfl", nflProvider],
  ["nba", nbaProvider],
]) {
  const meta = store.sportMeta(sport);
  const quota = new Quota(meta, config.schedule);
  const client = new ApiSports({ key: config.apiSportsKey, quota, log });
  schedulers.push(new TeamSportScheduler({ provider: make(client, config.leagues[sport]), store, cfg: config.schedule, log }));
}
if (config.ocBlacktopKey) {
  for (const [sport, leagueKey] of [["formula1", "f1"], ["moto-gp", "motogp"]]) {
    const league = config.leagues[leagueKey][0];
    const quota = new Quota(store.sportMeta(leagueKey), { dailyQuota: config.schedule.ocbDailyQuota, quotaReserve: 10 });
    const provider = motorsportProvider({ sport, league, key: config.ocBlacktopKey, quota, log, nationalities: leagueKey === "f1" ? f1Nationalities : undefined });
    schedulers.push(new CalendarScheduler({ provider, store, log, quota }));
  }
} else {
  log("no Orange Cat Blacktop key: Formula 1 via Jolpica, no MotoGP");
  schedulers.push(new CalendarScheduler({ provider: f1Provider(config.leagues.f1[0], log), store, log }));
}
{
  const meta = store.sportMeta("tennis");
  const quota = new Quota(meta, config.schedule);
  schedulers.push(new TeamSportScheduler({ provider: tennisProvider({ key: config.liveTennisKey, quota, log }), store, cfg: config.schedule, log }));
}

const photos = new PhotoResolver({ store, key: config.theSportsDbKey, log });
const app = createApp({ store, config, photos });
app.listen(config.port, config.host, () => {
  log(`tvscores proxy listening on http://${config.host}:${config.port} (prefix ${config.pathPrefix || "none"})`);
  for (const s of schedulers) s.start();
  setTimeout(() => photos.start(), 15000); // after the first fetches land
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    for (const s of schedulers) s.stop();
    photos.stop();
    store.save();
    app.close(() => process.exit(0));
  });
}
