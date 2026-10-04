import { STATE } from "./model.js";

/**
 * Matches finished from a last look and not yet asked for by id.
 *
 * A provider with no listing of finished matches (tennis on the free tier)
 * learns a match is over when it leaves the live feed, and its score then is
 * whatever the last look saw — up to half an hour old. Each is asked for by
 * id, a few a round while the budget allows; the rest wait in `meta.toConfirm`.
 */
// 8 a half hour fits a busy day of the 500s inside the 100-a-day tennis
// budget with the polls.
const CONFIRM_PER_ROUND = 8;
// A match that will not answer is let go: three tries, or a day.
const MAX_TRIES = 3;
const GIVE_UP_AFTER = 24 * 3600e3;

export async function confirmFinals(s, newIds, now) {
  const queue = [];
  const seen = new Set();
  for (const entry of [...(s.meta.toConfirm || []), ...newIds.map((id) => ({ id, tries: 0, since: now }))]) {
    // Entries from before tries were kept were bare ids.
    const e = typeof entry === "string" ? { id: entry, tries: 0, since: now } : entry;
    if (!seen.has(e.id)) { seen.add(e.id); queue.push(e); }
  }
  const left = [];
  let asked = 0;
  let paused = false; // upstream is refusing us: the rest wait for the next round, untried
  for (const e of queue) {
    if (paused || asked >= CONFIRM_PER_ROUND || s.quota.spendable(now) <= 0) { left.push(e); continue; }
    asked++;
    const retry = () => {
      if (e.tries + 1 < MAX_TRIES && now - e.since < GIVE_UP_AFTER) left.push({ ...e, tries: e.tries + 1 });
      else s.log(`${s.p.sport}: gave up confirming ${e.id}`);
    };
    try {
      const row = await s.p.byId(e.id);
      if (!row) s.log(`${s.p.sport}: ${e.id} unknown to the feed, left as last seen`);
      // Still in play by its own account: asked again next round.
      else if (row.status.state === STATE.live) retry();
      else {
        if (row.status.state !== STATE.final) s.log(`${s.p.sport}: ${e.id} ended as ${row.status.state}`);
        s.store.upsert([row]);
        s.noteResults([row]);
      }
    } catch (err) {
      s.log(`${s.p.sport}: confirm ${e.id} failed: ${err.message || err}`);
      // A rate limit or a server error is not the match's doing: no try is used up,
      // and no more are asked this round (three of those made the half-hour-old
      // score of a finished match permanent, 2026-10-02).
      if (err.status === 429 || err.status >= 500) { left.push(e); paused = true; }
      else retry();
    }
  }
  s.meta.toConfirm = left.length ? left : undefined;
}
