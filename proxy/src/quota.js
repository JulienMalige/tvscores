/** Daily call budget per sport, reset at UTC midnight like API-Sports does. */
export class Quota {
  constructor(meta, { dailyQuota, quotaReserve }) {
    this.meta = meta;
    this.dailyQuota = dailyQuota;
    this.reserve = quotaReserve;
  }

  static utcDay(now = Date.now()) {
    return new Date(now).toISOString().slice(0, 10);
  }

  rollover(now) {
    const day = Quota.utcDay(now);
    if (this.meta.calls.day !== day) this.meta.calls = { day, used: 0 };
  }

  remaining(now = Date.now()) {
    this.rollover(now);
    return Math.max(0, this.dailyQuota - this.meta.calls.used);
  }

  /** Calls we may still spend today after keeping the reserve. */
  spendable(now = Date.now()) {
    return Math.max(0, this.remaining(now) - this.reserve);
  }

  record(remainingFromHeader, now = Date.now()) {
    this.rollover(now);
    this.meta.calls.used += 1;
    if (Number.isFinite(remainingFromHeader)) {
      // Trust the upstream counter when it is lower than ours (other clients, restarts).
      const usedUpstream = this.dailyQuota - remainingFromHeader;
      if (usedUpstream > this.meta.calls.used) this.meta.calls.used = usedUpstream;
    }
  }

  /** Seconds until midnight UTC. */
  static secondsLeftInDay(now = Date.now()) {
    const d = new Date(now);
    const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
    return Math.max(1, Math.round((next - now) / 1000));
  }

  /**
   * Interval for live polling that never exhausts the day's budget:
   * at least `minSeconds`, stretched when the remaining calls would not last the day.
   */
  liveInterval(minSeconds, now = Date.now()) {
    const calls = this.spendable(now);
    if (calls <= 0) return Quota.secondsLeftInDay(now);
    return Math.max(minSeconds, Math.ceil(Quota.secondsLeftInDay(now) / calls));
  }
}
