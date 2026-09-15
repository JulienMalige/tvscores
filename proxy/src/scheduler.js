import { Quota } from "./quota.js";
import { STATE } from "./model.js";

const MIN = 60e3;
const STANDINGS_EVERY = 6 * 3600e3;
/** However badly upstream is doing, look again within the hour. */
const MAX_BACKOFF = 60 * 60e3;

/**
 * The wait after `failures` consecutive errors: the normal interval doubled
 * per failure, up to an hour. The ceiling applies to the *growth*, never to
 * the interval itself — a loop that already waits six hours between polls is
 * not made hungrier by failing.
 */
function backoff(base, failures = 0) {
  return Math.min(base * 2 ** Math.min(failures, 10), Math.max(base, MAX_BACKOFF));
}
/** A race weekend: worth asking about every half hour. */
const CALENDAR_LIVE = 30 * MIN;
/** Every other day of the fortnight: the calendar is not going to move. */
const CALENDAR_IDLE = 6 * 60 * MIN;

/** Shared: refresh a provider's standings every 6 h when it offers them. */
async function refreshStandings(self, now) {
  if (!self.p.standings) return;
  const last = self.meta.lastStandings ? Date.parse(self.meta.lastStandings) : 0;
  if (now - last < STANDINGS_EVERY) return;
  if (self.quota && self.quota.spendable(now) < 2) return;
  const data = await self.p.standings();
  const nonEmpty = (d) => d && d.tables && d.tables.some((t) => t.rows && t.rows.length);
  if (data && data.tables) {
    if (nonEmpty(data)) self.store.setStandings(self.p.sport, self.p.sport, data);
    else return self.log(`${self.p.sport}: empty standings ignored, keeping the previous table`);
  } else {
    for (const [leagueId, d] of Object.entries(data || {})) if (nonEmpty(d)) self.store.setStandings(self.p.sport, leagueId, d);
  }
  self.meta.lastStandings = new Date(now).toISOString();
  self.store.touch();
}

/**
 * One scheduler per team-sport provider. Two loops:
 *  - daily: fetch the whole window once per UTC day, or when stale.
 *  - live: while a tracked game is inside its live window, poll the live endpoint at an
 *    interval that provably fits the remaining daily quota.
 */
export class TeamSportScheduler {
  constructor({ provider, store, cfg, log }) {
    this.p = provider;
    this.store = store;
    this.cfg = cfg;
    this.log = log;
    this.meta = store.sportMeta(provider.sport);
    this.quota = new Quota(this.meta, cfg);
    this.timer = null;
  }

  events() {
    return this.store.all().filter((e) => e.sport === this.p.sport);
  }

  /**
   * Any tracked game that could be in progress right now?
   *
   * A game already reported live gets twice the window, because the cap is
   * sized for when a game is likely to have *started*, and some go long: a
   * five-set match or an overtime game outlives four hours. But the cap
   * applies to it all the same. A game left at "live" by a provider that
   * dropped it would otherwise hold the window open for ever, which costs a
   * call every interval and, worse, blocks the daily refresh: that one waits
   * for the window to close.
   */
  hasLiveWindow(now = Date.now()) {
    const before = 10 * MIN;
    const after = this.cfg.liveWindowHours * 3600e3;
    return this.events().some((e) => {
      const live = e.status.state === STATE.live;
      if (!live && e.status.state !== STATE.scheduled) return false;
      const t = Date.parse(e.start);
      return now >= t - before && now <= t + (live ? 2 * after : after);
    });
  }

  needsDaily(now = Date.now()) {
    const last = this.meta.lastDaily ? Date.parse(this.meta.lastDaily) : 0;
    const dayChanged = Quota.utcDay(last) !== Quota.utcDay(now) && new Date(now).getUTCHours() >= this.cfg.dailyRefreshHourUtc;
    const idle = now - last > this.cfg.idleRefreshMinutes * MIN;
    return !last || dayChanged || (idle && !this.hasLiveWindow(now));
  }

  async daily(now = Date.now()) {
    // A provider that fetches a week of dates spends a call per day, and must
    // not start the round with three calls left in the budget.
    const need = this.p.dailyCost ?? 1;
    if (this.quota.spendable(now) < need) return this.log(`${this.p.sport}: skip daily, quota ${this.quota.remaining(now)} left`);
    this.store.upsert(await this.p.daily());
    this.meta.lastDaily = new Date(now).toISOString();
    this.meta.lastOk = this.meta.lastDaily;
  }

  async live(now = Date.now()) {
    if (this.quota.spendable(now) <= 0) return this.log(`${this.p.sport}: skip live, quota exhausted`);
    const rows = await this.p.live();
    this.store.upsert(rows);
    // Games that should have started but are not in the live feed: they ended or were
    // postponed. Refresh today at most every 20 min to learn their final state.
    const liveIds = new Set(rows.map((r) => r.id));
    const orphans = this.events().filter((e) => e.status.state === STATE.live && !liveIds.has(e.id));
    if (this.p.finalizeOrphans) {
      // No terminal listing on this provider: a match gone from the live feed is over.
      this.store.upsert(orphans.map((e) => ({ ...e, status: { state: STATE.final, detail: e.status.detail?.startsWith("Set") ? undefined : e.status.detail } })));
    }
    const orphan = orphans.length > 0 && !this.p.finalizeOrphans;
    const lastToday = this.meta.lastToday ? Date.parse(this.meta.lastToday) : 0;
    if (orphan && now - lastToday > 20 * MIN && this.quota.spendable(now) > 0) {
      // Refetch the orphan's own UTC date: a game that started before midnight is not in "today".
      const date = new Date(orphans[0].start).toISOString().slice(0, 10);
      this.store.upsert(await this.p.byDate(date));
      this.meta.lastToday = new Date(now).toISOString();
    }
    this.meta.lastLive = new Date(now).toISOString();
    this.meta.lastOk = this.meta.lastLive;
  }

  /**
   * How long to wait before looking again: the normal interval, doubled per
   * consecutive failure. An upstream that is down, rate-limiting us or
   * throwing 500s gets asked less often rather than hammered at full rate —
   * and today's exhausted quotas are the reason that matters here.
   */
  nextDelay(now = Date.now()) {
    const base = this.hasLiveWindow(now) ? this.quota.liveInterval(this.cfg.liveIntervalSeconds, now) * 1000 : 5 * MIN;
    return backoff(base, this.meta.failures);
  }

  async tick() {
    const now = Date.now();
    try {
      if (this.needsDaily(now)) await this.daily(now);
      if (this.hasLiveWindow(now)) await this.live(now);
      await refreshStandings(this, now);
      this.meta.lastError = undefined;
      this.meta.failures = 0;
    } catch (err) {
      this.meta.failures = (this.meta.failures || 0) + 1;
      this.meta.lastError = { at: new Date(now).toISOString(), message: String(err.message || err) };
      this.log(`${this.p.sport}: ${err.message} (failure ${this.meta.failures})`);
    }
    this.store.prune(now);
    this.store.touch(); // meta (quota counters, timestamps) changed
    this.store.save();
    this.timer = setTimeout(() => this.tick(), this.nextDelay(now));
    this.timer.unref?.();
  }

  start() {
    this.tick();
  }

  stop() {
    clearTimeout(this.timer);
  }
}

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
   * when nothing happens. Half-hourly around a session, six-hourly otherwise.
   */
  nextDelay(now = Date.now()) {
    const near = this.store.all().some((e) => {
      if (e.sport !== this.p.sport) return false;
      const t = Date.parse(e.start);
      return now > t - 6 * 3600e3 && now < t + 6 * 3600e3;
    });
    return backoff(near ? CALENDAR_LIVE : CALENDAR_IDLE, this.meta.failures);
  }

  async tick() {
    const now = Date.now();
    try {
      const season = await this.p.season({ hasResults: (id) => this.store.hasResults(id) });
      // Keep cached podiums for rounds the provider did not re-fetch this time.
      const merged = season.map((e) => (e.results ? e : { ...e, results: this.store.events.get(e.id)?.results }));
      this.store.replaceSport(this.p.sport, merged);
      await refreshStandings(this, now);
      this.meta.lastOk = new Date(now).toISOString();
      this.meta.lastError = undefined;
      this.meta.failures = 0;
    } catch (err) {
      this.meta.failures = (this.meta.failures || 0) + 1;
      this.meta.lastError = { at: new Date(now).toISOString(), message: String(err.message || err) };
      this.log(`${this.p.sport}: ${err.message} (failure ${this.meta.failures})`);
    }
    this.store.touch();
    this.store.save();
    this.timer = setTimeout(() => this.tick(), this.nextDelay());
    this.timer.unref?.();
  }

  start() {
    this.tick();
  }

  stop() {
    clearTimeout(this.timer);
  }
}
