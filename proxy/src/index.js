import { join } from "node:path";
import { config } from "./config.js";
import { Store } from "./cache.js";
import { Quota } from "./quota.js";
import { sportsDbSport } from "./providers/sportsdb.js";
import { f1Provider, f1Nationalities } from "./providers/jolpica.js";
import { motorsportProvider } from "./providers/ocblacktop.js";
import { tennisProvider } from "./providers/livetennis.js";
import { TeamSportScheduler, CalendarScheduler } from "./scheduler.js";
import { createApp } from "./server.js";
import { PhotoResolver } from "./photos.js";
import { ImageMirror } from "./images.js";

const log = (msg) => console.log(`${new Date().toISOString()} ${msg}`);
const store = new Store(config.cacheDir);

const schedulers = [];
// The three team sports come from TheSportsDB on one paid key: it carries the
// leagues API-Sports' free plan cannot reach, real dates rather than
// yesterday-to-tomorrow, and a limit counted per minute rather than per day —
// which is what lets these poll every minute instead of every half hour.
for (const sport of ["football", "nfl", "nba"]) {
  const cfg = {
    ...config.schedule,
    dailyQuota: config.schedule.sportsDbDailyQuota,
    liveIntervalSeconds: config.schedule.liveIntervalSeconds[sport] ?? config.schedule.liveIntervalSeconds.default,
  };
  const quota = new Quota(store.sportMeta(sport), cfg);
  const provider = sportsDbSport({
    sport,
    key: config.theSportsDbKey,
    leagues: config.leagues[sport],
    window: config.schedule.teamSportWindow,
    quota,
    // Seasons are learned from the fixtures and written straight into the
    // sport's meta, which the store persists: a restart can read a table
    // before it has seen a fixture.
    seasons: (store.sportMeta(sport).seasons ??= {}),
    // The next fixture of a competition with nothing this week, same home.
    next: (store.sportMeta(sport).next ??= {}),
    log,
  });
  schedulers.push(new TeamSportScheduler({ provider, store, cfg, log }));
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
  schedulers.push(new CalendarScheduler({ provider: f1Provider(config.leagues.f1[0], log, store.sportMeta("f1")), store, log }));
}
{
  const meta = store.sportMeta("tennis");
  const cfg = { ...config.schedule, liveIntervalSeconds: config.schedule.liveIntervalSeconds.tennis ?? config.schedule.liveIntervalSeconds.default };
  const quota = new Quota(meta, cfg);
  schedulers.push(new TeamSportScheduler({ provider: tennisProvider({ key: config.liveTennisKey, quota, meta, tennis: config.tennis, log }), store, cfg, log }));
}

const photos = new PhotoResolver({ store, key: config.theSportsDbKey, log });
const images = new ImageMirror({ dir: join(config.cacheDir, "images"), publicBase: config.publicBase, log });
const limits = Object.fromEntries(schedulers.filter((s) => s.quota).map((s) => [s.p.sport, s.quota.dailyQuota]));
limits.photos = 1000; // TheSportsDB test key: ~30/min; a soft daily line for the health page
const app = createApp({ store, config, photos, images, activeSports: schedulers.map((s) => s.p.sport), limits });
app.listen(config.port, config.host, () => {
  log(`tvscores proxy listening on http://${config.host}:${config.port} (prefix ${config.pathPrefix || "none"})`);
  for (const s of schedulers) s.start();
  setTimeout(() => photos.start(), 15000); // after the first fetches land
  setTimeout(() => images.startWarming(), 25000); // after the board has named its images
  setInterval(() => images.prune(), 12 * 3600e3).unref?.();
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    for (const s of schedulers) s.stop();
    photos.stop();
    images.stop();
    store.save();
    app.close(() => process.exit(0));
  });
}
