import { flag } from "../model.js";

/**
 * Orange Cat Blacktop's result rows, turned into ours. Shared by a race, a
 * sprint and a qualifying session: the same driver fields, a different idea
 * of what goes in the gap column.
 */

/** "1:35.587" or "58.214" in seconds; undefined when there is no lap time. */
export function lapSeconds(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return undefined;
  const m = t.match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  if (!m) return undefined;
  return Number(m[1] || 0) * 60 + Number(m[2]);
}

/** A number the provider actually sent, zero included. */
export const num = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) ? undefined : Number(v));

/** A classified place, as opposed to "NC" or "DSQ". */
export const placed = (r) => /^\d+$/.test(String(r.position));

/** Who it is: the fields every row carries, whatever the session. */
export function driverFields(r, nationalities = {}) {
  const nat = nationalities[r.driver?.lastName];
  return {
    driver: `${(r.driver?.firstName || "?")[0]}. ${r.driver?.lastName || "?"}`,
    fullName: [r.driver?.firstName, r.driver?.lastName].filter(Boolean).join(" ") || undefined,
    code: r.driver?.code || undefined,
    nationality: nat,
    flag: flag(nat),
    team: r.team?.shortName || r.team?.name,
    teamColor: r.team?.color || undefined,
  };
}

/**
 * The whole classification of a race or a sprint, not just the podium: the
 * row shows the top three and the page the rest. Drivers who did not finish
 * come last, the one who covered most laps first, and carry no position.
 */
export function classify(results, nationalities = {}) {
  if (!Array.isArray(results) || !results.length) return undefined;
  const quickest = fastestLapId(results);
  const row = (r) => {
    const finished = placed(r);
    return {
      pos: finished ? Number(r.position) : undefined,
      ...driverFields(r, nationalities),
      // A retirement wants its outcome, not the gap it had when it stopped.
      gap: finished ? (Number(r.position) === 1 ? r.lapTime : gapText(r)) : (outcomeText(r) || "DNF"),
      grid: num(r.gridPosition),
      points: num(r.points),
      laps: num(r.laps),
      fastestLap: quickest && (r.id ?? r.driver?.id) === quickest ? true : undefined,
    };
  };
  return [
    ...results.filter(placed).sort((a, b) => Number(a.position) - Number(b.position)),
    ...results.filter((r) => !placed(r)).sort((a, b) => (Number(b.laps) || 0) - (Number(a.laps) || 0)),
  ].map(row);
}

/**
 * Who set the fastest lap. The feed carries a `fastestLap` object but leaves
 * it empty, so trust its rank when it has one and otherwise take the quickest
 * best lap in the field.
 */
function fastestLapId(rows) {
  const ranked = rows.find((r) => Number(r.fastestLap?.rank) === 1);
  if (ranked) return ranked.id ?? ranked.driver?.id;
  let best;
  for (const r of rows) {
    const s = lapSeconds(r.bestLapTime);
    if (s === undefined) continue;
    if (!best || s < best.s) best = { s, id: r.id ?? r.driver?.id };
  }
  return best?.id;
}

/** Motorsport's own shorthand for a car that did not make the flag. */
// MotoGP speaks in its own codes (OUTSTND, NOTFINISHFIRST); anything not
// classified is a retirement unless the feed says something more specific.
const OUTCOME = {
  retired: "DNF", dnf: "DNF", outstnd: "DNF", notfinishfirst: "DNF",
  dns: "DNS", "did not start": "DNS", notstarted: "DNS",
  dsq: "DSQ", disqualified: "DSQ", excluded: "DSQ",
};

/** DNF, DNS, DSQ: what a car that did not make the flag gets instead of a gap. */
function outcomeText(r) {
  for (const field of [r.status, r.displayTime, r.gap]) {
    const hit = OUTCOME[String(field || "").toLowerCase().trim()];
    if (hit) return hit;
  }
  return undefined;
}

/** F1 gives "+4.351s" in `gap`/`displayTime`; MotoGP gives a bare "0.657" in `displayTime`. */
function gapText(r) {
  const raw = r.gap || r.displayTime;
  if (raw == null || raw === "") return outcomeText(r);
  const t = String(raw).trim();
  if (/^\+?\d+(\.\d+)?s?$/.test(t)) return `+${t.replace(/^\+/, "").replace(/s$/, "")}s`;
  return t; // "+1 lap", "LAP 57", etc.
}
