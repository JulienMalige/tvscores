import { config } from "./config.js";
import { Store } from "./cache.js";
import { Quota } from "./quota.js";
import { ApiSports } from "./providers/apisports.js";
import { footballProvider } from "./providers/football.js";
import { nflProvider } from "./providers/nfl.js";
import { nbaProvider } from "./providers/nba.js";
import { f1Provider } from "./providers/jolpica.js";
import { TeamSportScheduler, F1Scheduler } from "./scheduler.js";
import { createApp } from "./server.js";

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
schedulers.push(new F1Scheduler({ provider: f1Provider(config.leagues.f1[0], log), store, log }));

const app = createApp({ store, config });
app.listen(config.port, config.host, () => {
  log(`tvscores proxy listening on http://${config.host}:${config.port} (prefix ${config.pathPrefix || "none"})`);
  for (const s of schedulers) s.start();
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    for (const s of schedulers) s.stop();
    store.save();
    app.close(() => process.exit(0));
  });
}
