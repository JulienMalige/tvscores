import { Quota } from "./quota.js";
import { confirmFinals } from "./finals.js";
import { STATE } from "./model.js";
import { MIN } from "./clock.js";
import { refreshStandings } from "./standings.js";
import { settle, fail } from "./persist.js";

/** A kickoff this far past with nothing to show for it deserves a second look. */
const OVERDUE = 15 * MIN;
/** However badly upstream is doing, look again within the hour. */
const MAX_BACKOFF = 60 * 60e3;

/**
 * The wait after `failures` consecutive errors: the normal interval doubled
 * per failure, up to an hour. The ceiling applies to the *growth*, never to
 * the interval itself — a loop that already waits six hours between polls is
 * not made hungrier by failing.
 */
export function backoff(base, failures = 0) {
  return Math.min(base * 2 ** Math.min(failures, 10), Math.max(base, MAX_BACKOFF));
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
    /** Leagues whose table a result has just changed. */
    this.dirtyLeagues = new Set();
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

  /**
   * Whether to ask the live feed this round. A tour's day is matches back to
   * back from morning to night, and the free tier's daily listing only has
   * those not yet begun: a match under way is only in the live feed. So a
   * provider can ask for it to be polled whatever we track. Otherwise a day
   * that starts with nothing tracked (the Beijing WTA 1000 on 28 September,
   * after a feed change had dropped its matches) never asks, and so never
   * finds anything to track.
   */
  pollsLive(now = Date.now()) {
    return Boolean(this.p.alwaysLive) || this.hasLiveWindow(now);
  }

  /**
   * Never while a game could be in progress: a new day waits for the window to
   * close as an idle one does (a full pass is nine calls, in the middle of a
   * 30-second poll, and it overwrites the live rows with the older feed's).
   * The valve is a day and a half: a window that is never shut must not mean
   * a board that is never refilled.
   */
  needsDaily(now = Date.now()) {
    const last = this.meta.lastDaily ? Date.parse(this.meta.lastDaily) : 0;
    if (!last || now - last > 36 * 3600e3) return true;
    if (this.hasLiveWindow(now)) return false;
    const dayChanged = Quota.utcDay(last) !== Quota.utcDay(now) && new Date(now).getUTCHours() >= this.cfg.dailyRefreshHourUtc;
    const idle = now - last > this.cfg.idleRefreshMinutes * MIN;
    // A pass that came back with a date or two missing is finished in half an hour.
    const unfinished = this.meta.retryDailyAfter && now >= Date.parse(this.meta.retryDailyAfter);
    return dayChanged || idle || Boolean(unfinished);
  }

  async daily(now = Date.now()) {
    // A provider that fetches a week of dates spends a call per day, and must
    // not start the round with three calls left in the budget.
    const need = this.p.dailyCost ?? 1;
    if (this.quota.spendable(now) < need) return this.log(`${this.p.sport}: skip daily, quota ${this.quota.remaining(now)} left`);
    const rows = await this.p.daily();
    this.store.upsert(rows);
    this.meta.lastDaily = new Date(now).toISOString();
    this.meta.lastOk = this.meta.lastDaily;
    if (rows.partial) this.meta.retryDailyAfter = new Date(now + 30 * MIN).toISOString();
    else delete this.meta.retryDailyAfter;
  }

  /**
   * A finished game moves a league table — but only where the table is a
   * table of results. Tennis rankings move once a week whatever happens on
   * court, so chasing them after every match would spend a 100-a-day budget
   * on a number that has not changed. Providers opt in.
   */
  noteResults(rows) {
    if (!this.p.standingsFollowResults) return;
    for (const e of rows) if (e.status.state === STATE.final) this.dirtyLeagues.add(String(e.league.id));
  }

  async live(now = Date.now()) {
    if (this.quota.spendable(now) <= 0) return this.log(`${this.p.sport}: skip live, quota exhausted`);
    const rows = await this.p.live();
    this.store.upsert(rows);
    this.noteResults(rows);
    // Games that should have started but are not in the live feed: they ended or were
    // postponed. Refresh today at most every 20 min to learn their final state.
    const liveIds = new Set(rows.map((r) => r.id));
    const orphans = this.events().filter((e) => e.status.state === STATE.live && !liveIds.has(e.id));
    if (this.p.finalizeOrphans) {
      // No terminal listing on this provider: a match gone from the live feed is over.
      this.store.upsert(orphans.map((e) => ({ ...e, status: { state: STATE.final, detail: e.status.detail?.startsWith("Set") ? undefined : e.status.detail } })));
      // Its score is what the last look saw, so each is asked for by id to
      // learn how it ended — a few a round, while the budget allows, the
      // rest on later rounds.
      if (this.p.byId) await confirmFinals(this, orphans.map((e) => e.id), now);
    }
    // A game that kicked off and never appeared in the live feed at all is
    // nobody's business but ours: the daily pass would correct it, and the
    // daily pass waits for the live window to close — which other games hold
    // open all evening. Botafogo v Grêmio sat at "19:30, no score" for four
    // hours that way.
    const overdue = this.p.byDate
      ? this.events().filter((e) => e.status.state === STATE.scheduled && now - Date.parse(e.start) > OVERDUE)
      : [];
    const needsLook = [...(this.p.finalizeOrphans ? [] : orphans), ...overdue].sort(
      (a, b) => Date.parse(a.start) - Date.parse(b.start),
    );
    const orphan = needsLook.length > 0;
    const lastToday = this.meta.lastToday ? Date.parse(this.meta.lastToday) : 0;
    // Twenty minutes on a hundred-a-day key; five where the budget is thousands,
    // so a game that ended is not "live" on the board for a third of an hour.
    const lookEvery = this.quota.dailyQuota >= 1000 ? 5 * MIN : 20 * MIN;
    if (orphan && now - lastToday > lookEvery && this.quota.spendable(now) > 0) {
      // Refetch its own UTC date: a game that started before midnight is not in "today".
      const date = new Date(needsLook[0].start).toISOString().slice(0, 10);
      const back = await this.p.byDate(date);
      this.store.upsert(back);
      this.noteResults(back);
      this.meta.lastToday = new Date(now).toISOString();
    }
    // A provider with no way to ask for a day (tennis on the free tier) cannot find out
    // what became of a match that was listed, never went live and was dropped from the
    // list: a walkover, a withdrawal. Twelve hours past its time, it is let go.
    if (!this.p.byDate) {
      for (const e of this.events()) {
        if (e.status.state === STATE.scheduled && now - Date.parse(e.start) > 12 * 3600e3) this.store.events.delete(e.id);
      }
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
    const base = this.pollsLive(now) ? this.quota.liveInterval(this.cfg.liveIntervalSeconds, now) * 1000 : 5 * MIN;
    return backoff(base, this.meta.failures);
  }

  async tick() {
    const now = Date.now();
    try {
      if (this.needsDaily(now)) await this.daily(now);
      if (this.pollsLive(now)) await this.live(now);
      this.meta.lastError = undefined;
      this.meta.failures = 0;
    } catch (err) {
      fail(this, err, now);
    }
    await refreshStandings(this, now); // never throws: the tables' failures are theirs (standings.js)
    settle(this, { now, prune: true, delay: () => this.nextDelay(now) });
  }

  start() {
    this.tick();
  }

  stop() {
    clearTimeout(this.timer);
  }
}
