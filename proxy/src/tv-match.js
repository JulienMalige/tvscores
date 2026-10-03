import { fold, english, teamWords } from "./tv-names.js";
import { MIN } from "./clock.js";

/**
 * Which of our events a TV-guide programme is. A guide lists reruns and
 * magazines alongside the games, so a programme only counts when it starts
 * between 45 minutes before a kickoff (the build-up) and 15 minutes after it,
 * and then only when it names both teams, is a race weekend's session, or
 * names a competition that has exactly one game of ours at that moment.
 * When in doubt — two games at once — nothing is guessed.
 */
const BEFORE = 45 * MIN;
// A listing that names both teams can open earlier: Ligue 1+ starts Lens /
// Lyon an hour before kickoff, pre-match included (review, build 33).
const BEFORE_NAMED = 90 * MIN;
const AFTER = 15 * MIN;

/** Guide titles of the form "<sport> : <competition>", folded. */
const COMPETITIONS = [
  { label: /^football$/, phrase: /^premier league\b/, sport: "football", league: 4328 },
  { label: /^football$/, phrase: /^(la ?liga|liga)( ea sports)?$/, sport: "football", league: 4335 },
  { label: /^football$/, phrase: /^serie a\b/, sport: "football", league: 4332 },
  { label: /^football$/, phrase: /^bundesliga$/, sport: "football", league: 4331 },
  { label: /^football$/, phrase: /^ligue 1\b/, sport: "football", league: 4334 },
  { label: /^football$/, phrase: /^ligue des champions\b/, sport: "football", league: 4480 },
  { label: /^football$/, phrase: /^ligue europa\b(?!.*conference)/, sport: "football", league: 4481 },
  { label: /^football$/, phrase: /^ligue des nations\b/, sport: "football", league: 4490 },
  { label: /^football$/, phrase: /^copa libertadores\b/, sport: "football", league: 4501 },
  { label: /^football$/, phrase: /^(championnat du bresil|brasileirao)\b/, sport: "football", league: 4351 },
  { label: /^football americain$/, phrase: /^nfl\b/, sport: "nfl", league: 4391 },
  { label: /^basket ?ball$/, phrase: /^(pre saison )?nba\b/, sport: "nba", league: 4387 },
];
/** Not the competition we follow, whatever its name starts with. */
const OTHER_SIDE = /\b(feminin\w*|women|u\d\d|espoirs|jeunes|youth|caf|afc|concacaf)\b/;

const RACES = [
  { sport: "f1", test: (t) => /\bformule 1\b/.test(t) && /\bgrand prix\b/.test(t) },
  { sport: "motogp", test: (t) => /\bmoto ?gp\b/.test(t) && /\bgrand prix\b/.test(t) },
];

/** The moments an event can be on air live: a match's kickoff, a weekend's qualifying, sprint and race. */
function slots(e) {
  if (e.kind === "race") {
    const s = (e.sessions || []).filter((x) => /race|qualifying|sprint/.test(x.kind || "")).map((x) => Date.parse(x.start));
    if (s.length) return s;
  }
  return [Date.parse(e.start)];
}

/** Our events, prepared once per guide. */
export function eventIndex(events) {
  return events
    .filter((e) => Number.isFinite(Date.parse(e.start)))
    .map((e) => ({ e, slots: slots(e), home: teamWords(e.home?.name), away: teamWords(e.away?.name) }));
}

/** "Levante / FC Barcelone", in a title or a sub-title, as two sets of English words. */
function pairs(...texts) {
  const out = [];
  for (const t of texts) {
    for (const part of String(t || "").split(/[|:]/)) {
      const m = /^(.+?)\s+(?:\/|vs\.?|contre)\s+(.+)$/i.exec(part.trim());
      if (m) out.push([m[1], m[2].split(/\.\s/)[0]].map((side) => new Set(english(side).split(" ").filter(Boolean))));
    }
  }
  return out;
}

/** 2 when a side is the team exactly, 1 when it contains the team's words, 0 otherwise. */
function fits(side, words) {
  if (!words.length || !words.every((w) => side.has(w))) return 0;
  return side.size === words.length ? 2 : 1;
}

function teamScore(x, [a, b]) {
  const straight = Math.min(fits(a, x.home), fits(b, x.away)) && fits(a, x.home) + fits(b, x.away);
  const swapped = Math.min(fits(a, x.away), fits(b, x.home)) && fits(a, x.away) + fits(b, x.home);
  return Math.max(straight, swapped);
}

/** The ids of our events this programme shows live; usually none, at most one. */
export function matchProgramme(p, index) {
  const t = Date.parse(p.start);
  if (!Number.isFinite(t)) return [];
  const within = (before) => index.filter((x) => x.slots.some((k) => t >= k - before && t <= k + AFTER));
  const sides = pairs(p.title, p.subTitle);
  if (sides.length) {
    const scored = within(BEFORE_NAMED).filter((x) => x.e.kind !== "race").map((x) => ({ x, score: Math.max(...sides.map((s) => teamScore(x, s))) }));
    const best = Math.max(0, ...scored.map((s) => s.score));
    const winners = scored.filter((s) => best > 0 && s.score === best);
    return winners.length === 1 ? [winners[0].x.e.id] : [];
  }
  const near = within(BEFORE);
  if (!near.length) return [];
  const text = fold(`${p.title} ${p.subTitle}`);
  const race = RACES.find((r) => r.test(text));
  if (race) return near.filter((x) => x.e.sport === race.sport).map((x) => x.e.id).slice(0, 1);
  const m = /^([^:]+?)\s*:\s*(.+)$/.exec(p.title);
  if (!m) return [];
  const label = fold(m[1]);
  const phrase = fold(m[2]);
  if (OTHER_SIDE.test(phrase)) return [];
  const comp = COMPETITIONS.find((c) => c.label.test(label) && c.phrase.test(phrase));
  if (!comp) return [];
  const only = near.filter((x) => x.e.sport === comp.sport && String(x.e.league?.id) === String(comp.league));
  return only.length === 1 ? [only[0].e.id] : [];
}
