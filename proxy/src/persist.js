/**
 * The end of a scheduler's tick: write what changed without letting the disk
 * stop the loop, then arm the next one. A tick that cannot save is a tick, and
 * the next tries again; a loop that dies here stops polling for good.
 */
export function settle(self, { now, prune = false, delay }) {
  try {
    if (prune) self.store.prune(now);
    self.store.touch(); // meta (quota counters, timestamps) changed
    self.store.save({ every: 20e3 });
  } catch (err) {
    self.log(`${self.p.sport}: could not save (${err.message})`);
  } finally {
    self.timer = setTimeout(() => self.tick(), delay());
    self.timer.unref?.();
  }
}

/** One more consecutive failure: counted (the wait doubles with it), said on the health page, and logged. */
export function fail(self, err, now) {
  self.meta.failures = (self.meta.failures || 0) + 1;
  self.meta.lastError = { at: new Date(now).toISOString(), message: String(err.message || err) };
  self.log(`${self.p.sport}: ${err.message} (failure ${self.meta.failures})`);
}
