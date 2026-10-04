import { MIN } from "./clock.js";
import { refreshStandings } from "./standings.js";
import { settle, fail } from "./persist.js";
import { backoff } from "./scheduler.js";

/** A race weekend: worth asking about every half hour. */
const CALENDAR_LIVE = 30 * MIN;
/** Every other day of the fortnight: the calendar is not going to move. */
const CALENDAR_IDLE = 6 * 60 * MIN;

/** Calendar sports (F1, MotoGP): season list + results of finished races. */
export class CalendarScheduler {
  constructor({ provider, store, log, quota }) {
    this.p = provider;
    this.store = store;
    this.log = log;
    this.quota = quota;
    this.meta = store.sportMeta(provider.sport);
  }

  /**
   * F1 and MotoGP race roughly every other weekend, so polling a season
   * calendar every half hour spends most of a month's free allowance on days
   * when nothing happens. Half-hourly around the race, and for three hours
   * after a qualifying or a sprint starts so its result is picked up within
   * half an hour of the flag; six-hourly otherwise.
   */
  nextDelay(now = Date.now()) {
    const near = this.store.all().some((e) => {
      if (e.sport !== this.p.sport) return false;
      const t = Date.parse(e.start);
      if (now > t - 6 * 3600e3 && now < t + 6 * 3600e3) return true;
      // A race that is over and has no classification yet is looked at every half hour.
      if (e.status?.state === "final" && !e.results?.length && now >= t && now < t + 3 * 86400e3) return true;
      return (e.sessions || []).some((s) => {
        const at = Date.parse(s.start);
        return ["qualifying", "sprint"].includes(s.kind) && now >= at && now < at + 3 * 3600e3;
      });
    });
    return backoff(near ? CALENDAR_LIVE : CALENDAR_IDLE, this.meta.failures);
  }

  async tick() {
    const now = Date.now();
    try {
      const season = await this.p.season({
        hasResults: (id) => this.store.hasResults(id),
        cachedSessions: (id) => this.store.events.get(id)?.sessionResults,
      });
      // An empty calendar (a year that has rolled over, an answer with no data)
      // is not a season with no rounds: the one we hold stays.
      if (!season.length && this.store.all().some((e) => e.sport === this.p.sport)) throw new Error("empty calendar, keeping the stored one");
      // Keep cached podiums for rounds the provider did not re-fetch this time,
      // and the stamp that says an empty classification was already asked for.
      const merged = season.map((e) => {
        const held = this.store.events.get(e.id);
        return e.results ? e : { ...e, results: held?.results, resultsFetchedAt: e.resultsFetchedAt ?? held?.resultsFetchedAt };
      });
      this.store.replaceSport(this.p.sport, merged);
      this.meta.lastOk = new Date(now).toISOString();
      this.meta.lastError = undefined;
      this.meta.failures = 0;
    } catch (err) {
      fail(this, err, now);
    }
    await refreshStandings(this, now); // never throws: the tables' failures are theirs (standings.js)
    settle(this, { now, delay: () => this.nextDelay() });
  }

  start() {
    this.tick();
  }

  stop() {
    clearTimeout(this.timer);
  }
}
