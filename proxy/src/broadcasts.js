import { getJson } from "./http.js";
import { MIN } from "./clock.js";
import { backoff } from "./scheduler.js";
import { COUNTRIES, tsdbChannelName, fold } from "./tv-names.js";
import { xmltvElements, programme, fetchXmltv } from "./xmltv.js";
import { eventIndex, matchProgramme } from "./tv-match.js";

const V2 = "https://www.thesportsdb.com/api/v2/json";
/** Names shown per event, at most. */
const MAX_NAMES = 4;
/** The team sports whose daily pass should land before we match against it. */
const TEAM_SPORTS = ["football", "nfl", "nba"];
const day = (t) => new Date(t).toISOString().slice(0, 10);

/**
 * Where each game airs, in one country: TheSportsDB's TV rows first, then
 * the national TV guide (XMLTV), then our hand-kept rights table for a
 * competition that has one broadcaster. Each source is fetched once per UTC
 * day, after the schedules' own daily pass, and the result is kept in the
 * store, so a restart or a failed download serves the last good answer.
 */
export class Broadcasts {
  constructor({ store, country = "FR", key, table = [], cfg = {}, log = () => {}, fetchJson = getJson, openGuide = fetchXmltv }) {
    Object.assign(this, { store, key, table, log, fetchJson, openGuide });
    this.country = COUNTRIES[country];
    this.refreshHour = (cfg.dailyRefreshHourUtc ?? 4) + 1;
    this.meta = store.sportMeta("broadcasts");
    this.meta.sources ??= {};
    this.timer = null;
  }

  get state() {
    return this.store.broadcasts;
  }

  /** The names to show for one event, or an empty list. */
  for(e) {
    const tsdbId = /:tsdb:(\d+)$/.exec(e.id)?.[1];
    const seen = new Set();
    const names = [...((tsdbId && this.state.tsdb?.[tsdbId]) || []), ...(this.state.xmltv?.[e.id] || [])]
      .filter((n) => !seen.has(fold(n)) && seen.add(fold(n)))
      .slice(0, MAX_NAMES);
    if (names.length) return names;
    const on = String(e.start || "").slice(0, 10);
    const row = this.table.find((r) => r.sport === e.sport && String(r.league) === String(e.league?.id)
      && (!r.tier || [].concat(r.tier).includes(e.competition?.tier)) && (!r.from || on >= r.from) && (!r.until || on <= r.until));
    return row ? row.names.slice(0, MAX_NAMES) : [];
  }

  /** The schedules are in for today, or have had three hours to be. */
  teamsReady(now) {
    const fresh = TEAM_SPORTS.every((s) => this.store.meta[s]?.lastDaily && day(this.store.meta[s].lastDaily) === day(now));
    return fresh || new Date(now).getUTCHours() >= this.refreshHour + 3;
  }

  due(source, now = Date.now()) {
    const s = (this.meta.sources[source] ??= {});
    if (s.retryAt && now < Date.parse(s.retryAt)) return false;
    if (!s.ok) return true;
    return day(s.ok) !== day(now) && new Date(now).getUTCHours() >= this.refreshHour && this.teamsReady(now);
  }

  /** Last run's entries for games already started that this run no longer lists. */
  keepPast(old = {}, fresh, idOf, now) {
    const started = new Map(this.store.all().filter((e) => Date.parse(e.start) < now).map((e) => [idOf(e), e]));
    const out = {};
    for (const [id, names] of Object.entries(old)) if (started.has(id)) out[id] = names;
    return Object.assign(out, fresh);
  }

  async fetchTsdb(now) {
    const { body } = await this.fetchJson(`${V2}/filter/tv/country/${encodeURIComponent(this.country.tsdb)}`, { headers: { "X-API-KEY": this.key } });
    const rows = Array.isArray(body?.filter) ? body.filter : Object.values(body || {}).find(Array.isArray) || [];
    const fresh = {};
    for (const r of rows) {
      const name = tsdbChannelName(r.strChannel);
      if (!r.idEvent || !name || (r.strCountry && r.strCountry !== this.country.tsdb)) continue;
      const list = (fresh[r.idEvent] ??= []);
      if (!list.includes(name)) list.push(name);
    }
    this.state.tsdb = this.keepPast(this.state.tsdb, fresh, (e) => /:tsdb:(\d+)$/.exec(e.id)?.[1], now);
    return Object.keys(fresh).length;
  }

  async fetchGuide(now) {
    const channels = this.country.channels;
    const index = eventIndex(this.store.all().filter((e) => Math.abs(Date.parse(e.start) - now) < 12 * 1440 * MIN));
    const fresh = {};
    let kept = 0;
    for await (const el of xmltvElements(await this.openGuide(this.country.xmltv))) {
      if (el.tag !== "programme" || !channels[el.attrs.channel]) continue;
      const p = programme(el);
      if (p.rerun) continue;
      kept++;
      for (const id of matchProgramme(p, index)) {
        const list = (fresh[id] ??= []);
        if (!list.includes(channels[p.channel])) list.push(channels[p.channel]);
      }
    }
    // A guide that lists none of our channels is a broken file, not a quiet week.
    if (!kept) throw new Error("the guide lists none of our channels");
    this.state.xmltv = this.keepPast(this.state.xmltv, fresh, (e) => e.id, now);
    return Object.keys(fresh).length;
  }

  /** Each source that is due, independently: one failing keeps its last answer and backs off. */
  async refresh(now = Date.now()) {
    const sources = { tsdb: () => this.fetchTsdb(now), xmltv: () => this.fetchGuide(now) };
    if (!this.key) delete sources.tsdb;
    for (const [name, run] of Object.entries(sources)) {
      if (!this.due(name, now)) continue;
      const s = this.meta.sources[name];
      try {
        const n = await run();
        Object.assign(s, { ok: new Date(now).toISOString(), failures: 0, retryAt: undefined });
        this.meta.lastOk = s.ok;
        this.meta.lastError = undefined;
        this.log(`broadcasts: ${name} -> ${n} events with a channel`);
      } catch (err) {
        s.failures = (s.failures || 0) + 1;
        s.retryAt = new Date(now + backoff(30 * MIN, s.failures - 1)).toISOString();
        this.meta.lastError = { at: new Date(now).toISOString(), message: `${name}: ${err.message || err}` };
        this.log(`broadcasts: ${name} ${err.message || err} (failure ${s.failures})`);
      }
      this.store.touch();
    }
  }

  async tick() {
    try {
      await this.refresh();
      this.store.save();
    } catch (err) {
      this.log(`broadcasts: ${err.message || err}`);
    } finally {
      // Wakes hourly to see whether a source is due; it asks nothing otherwise.
      this.timer = setTimeout(() => this.tick(), 60 * MIN);
      this.timer.unref?.();
    }
  }

  start() {
    this.tick();
  }

  stop() {
    clearTimeout(this.timer);
  }
}
