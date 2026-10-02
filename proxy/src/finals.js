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

export async function confirmFinals(s, newIds, now) {
  const queue = [...new Set([...(s.meta.toConfirm || []), ...newIds])];
  const left = [];
  let asked = 0;
  for (const id of queue) {
    if (asked >= CONFIRM_PER_ROUND || s.quota.spendable(now) <= 0) { left.push(id); continue; }
    asked++;
    try {
      const row = await s.p.byId(id);
      // Over by its own account; one still in play waits for the live feed.
      if (row?.status.state === STATE.final) { s.store.upsert([row]); s.noteResults([row]); }
      else if (row?.status.state === STATE.live) left.push(id);
    } catch (err) {
      left.push(id);
      s.log(`${s.p.sport}: confirm ${id} failed: ${err.message || err}`);
    }
  }
  s.meta.toConfirm = left.length ? left : undefined;
}
