/**
 * When a league table is worth asking for again.
 *
 * Its own module because both schedulers call it and neither owns it, and
 * because "every six hours, or ten minutes after a final whistle, unless the
 * last look found nothing" is a rule in its own right.
 */
import { MIN } from "./clock.js";

const STANDINGS_EVERY = 6 * 3600e3;
/** A final whistle moves the table; do not make anyone wait six hours to see it. */
const STANDINGS_AFTER_GAME = 10 * MIN;
/** Nothing came back: a season between campaigns, or a provider having a bad day. */
const STANDINGS_RETRY = 30 * MIN;

/**
 * Refresh a provider's standings: every 6 h, and within ten minutes of a final
 * whistle in a league whose table just changed. A table nobody can see move is
 * the thing that makes an app feel dead, and it costs one call per league.
 */
export async function refreshStandings(self, now) {
  if (!self.p.standings) return;
  const last = self.meta.lastStandings ? Date.parse(self.meta.lastStandings) : 0;
  const dirty = self.dirtyLeagues?.size ? new Set(self.dirtyLeagues) : null;
  // An attempt that found no table at all must not buy six hours of silence:
  // the season may start tomorrow, or the provider may simply have been down.
  const due = now - last >= (self.meta.standingsEmpty ? STANDINGS_RETRY : STANDINGS_EVERY);
  if (!due && !(dirty && now - last >= STANDINGS_AFTER_GAME)) return;
  if (self.quota && self.quota.spendable(now) < 2) return;
  const data = await self.p.standings(due ? undefined : dirty);
  self.dirtyLeagues?.clear();
  const nonEmpty = (d) => d && d.tables && d.tables.some((t) => t.rows && t.rows.length);
  if (data && data.tables) {
    if (nonEmpty(data)) self.store.setStandings(self.p.sport, self.p.sport, data);
    else return self.log(`${self.p.sport}: empty standings ignored, keeping the previous table`);
  } else {
    const found = Object.entries(data || {}).filter(([, d]) => nonEmpty(d));
    for (const [leagueId, d] of found) self.store.setStandings(self.p.sport, leagueId, d);
    self.meta.standingsEmpty = found.length === 0;
  }
  self.meta.lastStandings = new Date(now).toISOString();
  self.store.touch();
}
