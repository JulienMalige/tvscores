import { Quota } from "./quota.js";
import { STATE } from "./model.js";

const MIN = 60e3;
const STANDINGS_EVERY = 6 * 3600e3;

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

function dateOffset(offset, now = Date.now()) {
  return new Date(now + offset * 86400e3).toISOString().slice(0, 10);
}

/**
 * One scheduler per team-sport provider. Two loops:
 *  - daily: fetch yesterday/today/tomorrow (3 calls) once per UTC day, or when stale.
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
    const need = this.p.daily ? 1 : this.cfg.dayOffsets.length;
    if (this.quota.spendable(now) < need) return this.log(`${this.p.sport}: skip daily, quota ${this.quota.remaining(now)} left`);
    if (this.p.daily) {
      this.store.upsert(await this.p.daily());
    } else {
      for (const off of this.cfg.dayOffsets) {
        const rows = await this.p.byDate(dateOffset(off, now));
        this.store.upsert(rows);
      }
    }
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

  async tick() {
    const now = Date.now();
    try {
      if (this.needsDaily(now)) await this.daily(now);
      if (this.hasLiveWindow(now)) await this.live(now);
      await refreshStandings(this, now);
      this.meta.lastError = undefined;
    } catch (err) {
      this.meta.lastError = { at: new Date(now).toISOString(), message: String(err.message || err) };
      this.log(`${this.p.sport}: ${err.message}`);
    }
    this.store.prune(now);
    this.store.touch(); // meta (quota counters, timestamps) changed
    this.store.save();
    const next = this.hasLiveWindow(now) ? this.quota.liveInterval(this.cfg.liveIntervalSeconds, now) * 1000 : 5 * MIN;
    this.timer = setTimeout(() => this.tick(), next);
    this.timer.unref?.();
  }

  start() {
    this.tick();
  }

  stop() {
    clearTimeout(this.timer);
  }
}

/** Calendar sports (F1, MotoGP): season list + results of finished races, every 30 min. */
export class CalendarScheduler {
  constructor({ provider, store, log, quota }) {
    this.p = provider;
    this.store = store;
    this.log = log;
    this.quota = quota;
    this.meta = store.sportMeta(provider.sport);
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
    } catch (err) {
      this.meta.lastError = { at: new Date(now).toISOString(), message: String(err.message || err) };
      this.log(`${this.p.sport}: ${err.message}`);
    }
    this.store.touch();
    this.store.save();
    this.timer = setTimeout(() => this.tick(), 30 * MIN);
    this.timer.unref?.();
  }

  start() {
    this.tick();
  }

  stop() {
    clearTimeout(this.timer);
  }
}
