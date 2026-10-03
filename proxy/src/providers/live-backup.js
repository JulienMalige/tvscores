import { getJson } from "../http.js";
import { Quota } from "../quota.js";
import { normaliseStats, normaliseTimeline } from "../details.js";

const BASE = "https://v3.football.api-sports.io";
const LIST_TTL = 60e3;        // the live list is shared by every game that asks
const MIN_GAP = 5 * 60e3;     // one game's numbers are not asked again sooner
const KICKOFF_SLACK = 45 * 60e3;

const plain = (name) => String(name || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** "Atletico-MG" and "Atlético Mineiro" are one club: one name holds the other, or they share six letters. */
export function sameClub(a, b) {
  const x = plain(a), y = plain(b);
  if (!x || !y) return false;
  return x.includes(y) || y.includes(x) || (x.length >= 6 && y.length >= 6 && x.slice(0, 6) === y.slice(0, 6));
}

/**
 * Live statistics and goals for the competitions TheSportsDB leaves empty
 * while a game is on (the Brasileirão: checked 2026-10-03, API-Sports
 * answered with both for a game TheSportsDB had nothing for). API-Sports'
 * free plan allows 100 calls a day, so this is a fallback for one game at a
 * time: it runs only when TheSportsDB had nothing, asks for one game no more
 * than every five minutes, and stops at the day's budget less a reserve.
 */
export class LiveBackup {
  constructor({ key, meta, leagues = { 4351: 71 }, dailyQuota = 100, quotaReserve = 10, fetch = getJson, now = () => Date.now(), log = () => {} }) {
    Object.assign(this, { key, leagues, fetch, now, log });
    this.quota = new Quota(meta, { dailyQuota, quotaReserve });
    this.list = new Map();   // api league -> { at, fixtures }
    this.games = new Map();  // our event id -> { fixture, at, result }
  }

  covers(event) {
    return Boolean(this.key) && event.sport === "football" && event.status?.state === "live" && this.leagues[event.league?.id] !== undefined;
  }

  /** What the backup last held for a game, for the hours after the whistle while TheSportsDB is still empty. */
  last(event) {
    return this.games.get(event.id)?.result;
  }

  async call(path) {
    if (this.quota.spendable(this.now()) <= 0) return undefined;
    const { body, remaining } = await this.fetch(`${BASE}${path}`, { headers: { "x-apisports-key": this.key } });
    this.quota.record(remaining, this.now());
    // A refused call is an HTTP 200 with its reason in `errors`, and nothing in `response`.
    const errors = body?.errors;
    if (errors && (Array.isArray(errors) ? errors.length : Object.keys(errors).length)) {
      throw new Error(`API-Sports: ${JSON.stringify(errors)}`);
    }
    return body;
  }

  async liveFixtures(league) {
    const hit = this.list.get(league);
    if (hit && this.now() - hit.at < LIST_TTL) return hit.fixtures;
    const body = await this.call(`/fixtures?live=all&league=${league}`);
    if (!body) return [];
    const fixtures = body.response || [];
    this.list.set(league, { at: this.now(), fixtures });
    return fixtures;
  }

  /**
   * The API-Sports fixture for one of our games: same kickoff to within 45
   * minutes, and both clubs. Atlético-MG and Atlético-GO read alike, so when
   * two fixtures fit, the one with our score wins; two still, none.
   */
  async findFixture(event) {
    const kickoff = Date.parse(event.start);
    const fixtures = await this.liveFixtures(this.leagues[event.league.id]);
    const fits = fixtures.filter((f) => Math.abs(f.fixture.timestamp * 1000 - kickoff) <= KICKOFF_SLACK
      && sameClub(f.teams.home.name, event.home.name) && sameClub(f.teams.away.name, event.away.name));
    if (fits.length <= 1) return fits[0];
    const same = fits.filter((f) => f.goals?.home === event.score?.home && f.goals?.away === event.score?.away);
    return same.length === 1 ? same[0] : undefined;
  }

  /** { stats, timeline } in the shapes details.js serves, or undefined when there is nothing to add. */
  async detail(event) {
    if (!this.covers(event)) return undefined;
    if (this.games.size > 50) this.games.delete(this.games.keys().next().value);
    const known = this.games.get(event.id);
    if (known && this.now() - known.at < (known.fixture ? MIN_GAP : LIST_TTL)) return known.result;
    try {
      const fixture = known?.fixture ?? (await this.findFixture(event));
      if (!fixture) {
        this.games.set(event.id, { at: this.now(), result: known?.result });
        return known?.result;
      }
      const id = fixture.fixture.id;
      // One after the other, so the budget is counted between them.
      const stats = await this.call(`/fixtures/statistics?fixture=${id}`);
      const events = stats ? await this.call(`/fixtures/events?fixture=${id}`) : undefined;
      // Out of budget half way: keep what the last round found rather than an empty page.
      if (!stats || !events) {
        this.games.set(event.id, { fixture, at: this.now(), result: known?.result });
        return known?.result;
      }
      const result = {
        stats: normaliseStats("football", statRows(stats?.response)),
        timeline: normaliseTimeline(eventRows(events?.response, fixture.teams.home.id)),
      };
      this.games.set(event.id, { fixture, at: this.now(), result });
      this.log(`GET api-sports backup ${id} -> ${result.stats.length} stats, ${result.timeline.length} moments`);
      return result;
    } catch (err) {
      this.log(`api-sports backup for ${event.id} failed: ${err.message}`);
      return known?.result;
    }
  }
}

/** API-Sports' two team blocks as TheSportsDB's rows (`strStat`, `intHome`, `intAway`). */
export function statRows(response) {
  if (!Array.isArray(response) || response.length < 2) return [];
  const [home, away] = response;
  return home.statistics.map((s) => ({
    strStat: s.type,
    intHome: s.value,
    intAway: away.statistics.find((a) => a.type === s.type)?.value,
  }));
}

/** API-Sports' events as TheSportsDB's timeline rows; a missed penalty is not a goal. */
export function eventRows(response, homeId) {
  if (!Array.isArray(response)) return [];
  return response
    .filter((e) => (e.type === "Goal" || e.type === "Card") && !/missed/i.test(e.detail))
    .map((e) => ({
      strTimeline: e.type,
      strTimelineDetail: e.detail,
      intTime: (e.time?.elapsed ?? 0) + (e.time?.extra ?? 0),
      strHome: e.team?.id === homeId ? "Yes" : "No",
      strPlayer: e.player?.name,
    }));
}
