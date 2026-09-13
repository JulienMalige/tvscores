import { Quota } from "./quota.js";
import { STATE } from "./model.js";

const MIN = 60e3;

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

  /** Any tracked game that could be in progress right now? */
  hasLiveWindow(now = Date.now()) {
    const before = 10 * MIN;
    const after = this.cfg.liveWindowHours * 3600e3;
    return this.events().some((e) => {
      if (e.status.state === STATE.live) return true;
      if (e.status.state !== STATE.scheduled) return false;
      const t = Date.parse(e.start);
      return now >= t - before && now <= t + after;
    });
  }

  needsDaily(now = Date.now()) {
    const last = this.meta.lastDaily ? Date.parse(this.meta.lastDaily) : 0;
    const dayChanged = Quota.utcDay(last) !== Quota.utcDay(now) && new Date(now).getUTCHours() >= this.cfg.dailyRefreshHourUtc;
    const idle = now - last > this.cfg.idleRefreshMinutes * MIN;
    return !last || dayChanged || (idle && !this.hasLiveWindow(now));
  }

  async daily(now = Date.now()) {
    const need = this.cfg.dayOffsets.length;
    if (this.quota.spendable(now) < need) return this.log(`${this.p.sport}: skip daily, quota ${this.quota.remaining(now)} left`);
    for (const off of this.cfg.dayOffsets) {
      const rows = await this.p.byDate(dateOffset(off, now));
      this.store.upsert(rows);
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
    const orphan = this.events().some((e) => e.status.state === STATE.live && !liveIds.has(e.id));
    const lastToday = this.meta.lastToday ? Date.parse(this.meta.lastToday) : 0;
    if (orphan && now - lastToday > 20 * MIN && this.quota.spendable(now) > 0) {
      this.store.upsert(await this.p.byDate(dateOffset(0, now)));
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
      this.meta.lastError = undefined;
    } catch (err) {
      this.meta.lastError = { at: new Date(now).toISOString(), message: String(err.message || err) };
      this.log(`${this.p.sport}: ${err.message}`);
    }
    this.store.prune(now);
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

/** Formula 1 via Jolpica: calendar + last result, refreshed every 30 min (no quota). */
export class F1Scheduler {
  constructor({ provider, store, log }) {
    this.p = provider;
    this.store = store;
    this.log = log;
    this.meta = store.sportMeta("f1");
  }

  async tick() {
    const now = Date.now();
    try {
      this.store.upsert(await this.p.season());
      this.meta.lastOk = new Date(now).toISOString();
      this.meta.lastError = undefined;
    } catch (err) {
      this.meta.lastError = { at: new Date(now).toISOString(), message: String(err.message || err) };
      this.log(`f1: ${err.message}`);
    }
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
