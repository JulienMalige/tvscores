import { classify, driverFields, lapSeconds, placed } from "./ocb-rows.js";

/**
 * Qualifying and sprint results, the Saturday half of a weekend. Apple Sports
 * shows "Qualifying · Final" with the front row as soon as the session is
 * over, and the race's page carries the starting grid; the feed has the
 * classification of every session, so each is fetched once it has ended.
 *
 * A kind is fetched when every session of it is completed: MotoGP runs Q1
 * then Q2, and its grid is Q2's twelve followed by the rest of Q1. F1's
 * sprint shootout is left out: the grid that matters is the race's.
 */
const KINDS = ["qualifying", "sprint"];
/**
 * An empty or failed answer is asked again at later rounds until the race
 * starts — a feed can publish a grid hours after "completed" (review, build
 * 35) — and at most this many times.
 */
const TRIES = 12;
/** Past this, a classified weekend keeps what it has and asks for nothing new. */
const AFTER_RACE_MS = 2 * 86400e3;

/** "01:42.371" reads "1:42.371". */
const lapText = (t) => (t ? String(t).trim().replace(/^0(\d:)/, "$1") : undefined);

/** Same driver across Q1 and Q2: the feed's id, else the name and number. */
const who = (r) => r.driver?.id ?? `${r.driver?.firstName} ${r.driver?.lastName} ${r.carNumber}`;

/**
 * The order the cars line up in, from the qualifying sessions in running
 * order: the last session's classification, then each earlier one's drivers
 * not already placed. Each row carries its best lap as `time` and the gap to
 * pole as `gap`. Penalties applied after qualifying are not in the feed.
 */
function gridRows(sessions, nationalities = {}) {
  const seen = new Set();
  const ordered = [];
  for (const rows of [...sessions].reverse()) {
    const sorted = [...rows.filter(placed).sort((a, b) => Number(a.position) - Number(b.position)), ...rows.filter((r) => !placed(r))];
    for (const r of sorted) {
      if (seen.has(who(r))) continue;
      seen.add(who(r));
      ordered.push(r);
    }
  }
  const pole = lapSeconds(lapText(ordered[0]?.lapTime));
  return ordered.map((r, i) => {
    const time = lapText(r.lapTime || r.bestLapTime);
    const s = lapSeconds(time);
    return {
      pos: i + 1,
      ...driverFields(r, nationalities),
      time,
      gap: i > 0 && s !== undefined && pole !== undefined ? `+${(s - pole).toFixed(3)}s` : undefined,
    };
  });
}

/** The weekend's sessions by kind, in running order, for the kinds we show. */
function groups(e) {
  const out = [];
  for (const kind of KINDS) {
    const list = (e.schedule || []).filter((s) => s.type === kind && s.startTime)
      .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
    if (list.length) out.push({ kind, list });
  }
  return out;
}

/**
 * The weekend's `sessionResults`, starting from what is cached and fetching
 * what has ended since. `fetch(sessionId)` answers the feed's rows; it is
 * only called when `budget()` allows it.
 *
 * @returns {Promise<{ sessionResults?: object[], calls: number }>}
 */
export async function sessionResults(e, { cached = [], fetch, budget = () => true, nationalities = {}, now = Date.now() }) {
  const out = [...(cached || [])];
  let calls = 0;
  const race = (e.schedule || []).find((s) => s.type === "race");
  const settled = race?.status === "completed" && now - Date.parse(race.startTime) > AFTER_RACE_MS;
  for (const { kind, list } of groups(e)) {
    if (settled || !list.every((s) => s.status === "completed")) continue;
    const i = out.findIndex((x) => x.kind === kind);
    const had = out[i];
    const raceStarted = race && now >= Date.parse(race.startTime);
    if (had && (had.results?.length || (had.tries || 0) >= TRIES || raceStarted)) continue;
    if (!budget(list.length)) continue;
    const answers = [];
    try {
      for (const s of list) {
        const body = await fetch(s.id);
        calls += 1;
        answers.push(Array.isArray(body) ? body : body?.data || []);
      }
    } catch {
      // One session's error is not the calendar's: counted as an empty
      // answer, tried again next round (review, build 35).
      answers.length = 0;
    }
    const last = list.at(-1);
    const results = kind === "qualifying" ? gridRows(answers, nationalities) : classify(answers.at(-1), nationalities) || [];
    const entry = {
      kind,
      name: kind === "qualifying" ? "Qualifying" : last.name,
      start: new Date(last.startTime).toISOString(),
      results,
      ...(results.length ? {} : { tries: (had?.tries || 0) + 1 }),
    };
    if (i >= 0) out[i] = entry; else out.push(entry);
  }
  out.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  return { sessionResults: out.length ? out : undefined, calls };
}
