import { fold, english, teamWords } from "./tv-names.js";
import { MIN } from "./clock.js";

/**
 * Which of our events a TV-guide programme is. A guide lists reruns and
 * magazines alongside the games, so a programme only counts when it starts
 * between 45 minutes before a kickoff (the build-up) and 15 minutes after it,
 * and then only when it names both teams, is a race weekend's session, or
 * names a competition that has exactly one game of ours at that moment —
 * or several, and its description names one first. Women's and youth games
 * never count. When in doubt, nothing is guessed. French, American and
 * Brazilian guides each write these their own way (VOCAB).
 */
const BEFORE = 45 * MIN;
// A listing that names both teams can open earlier: Ligue 1+ starts Lens /
// Lyon an hour before kickoff, pre-match included (review, build 33).
const BEFORE_NAMED = 90 * MIN;
const AFTER = 15 * MIN;

/**
 * What each guide's language calls a competition, how it writes a game
 * ("Lens / Lyon", "Knicks at 76ers", "Flamengo x Palmeiras"), and a race
 * weekend's sessions. Competitions are tested on the folded title, once a
 * "Live:" or "- Ao Vivo" marker is gone. `named`: only ever by the
 * description — a guide's friendly is as often a club's pre-season.
 */
const FOOT = (league, test, named) => ({ sport: "football", league, test, named });
const VOCAB = {
  fr: {
    sep: /^(.+?)\s+(?:\/|vs\.?|contre)\s+(.+)$/i,
    competitions: [
      FOOT(4328, /^football premier league\b/),
      FOOT(4335, /^football (la ?liga|liga)( ea sports)?$/),
      FOOT(4332, /^football serie a\b/),
      FOOT(4331, /^football bundesliga$/),
      FOOT(4334, /^football ligue 1\b/),
      FOOT(4480, /^football ligue des champions\b/),
      FOOT(4481, /^football ligue europa\b(?!.*conference)/),
      FOOT(4490, /^football ligue des nations\b/),
      FOOT(4501, /^football copa libertadores\b/),
      FOOT(4562, /^football match amical\b/, true),
      FOOT(4351, /^football (championnat du bresil|brasileirao)\b/),
      { sport: "nfl", league: 4391, test: /^football americain nfl\b/ },
      { sport: "nba", league: 4387, test: /^basket ?ball (pre saison )?nba\b/ },
    ],
    races: { f1: (t) => /\bformule 1\b/.test(t) && /\bgrand prix\b/.test(t), motogp: (t) => /\bmoto ?gp\b/.test(t) && /\bgrand prix\b/.test(t) },
  },
  en: {
    sep: /^(.+?)\s+(?:vs\.?|v\.?|at)\s+(.+)$/i,
    competitions: [
      FOOT(4328, /^(english )?premier league soccer\b/),
      FOOT(4335, /^(spanish )?la ?liga soccer\b/),
      FOOT(4332, /^(italian )?serie a soccer\b/),
      FOOT(4331, /^(german )?bundesliga soccer\b/),
      FOOT(4334, /^(french )?ligue 1 soccer\b/),
      FOOT(4480, /^uefa champions league soccer\b/),
      FOOT(4481, /^uefa europa league soccer\b/),
      FOOT(4490, /^uefa nations league soccer\b/),
      FOOT(4501, /^(conmebol )?(copa )?libertadores soccer\b/),
      FOOT(4562, /^(international )?(soccer )?friendl(y|ies)\b|^international friendly soccer\b/, true),
      FOOT(4351, /^(brazilian serie a|brasileirao) soccer\b/),
      { sport: "nfl", league: 4391, test: /^nfl football\b/ },
      { sport: "nba", league: 4387, test: /^nba (preseason )?basketball\b/ },
    ],
    races: {
      f1: (t) => /\b(formula (1|one)|f1)\b/.test(t) && /\b(racing|race|grand prix|qualifying|sprint)\b/.test(t),
      motogp: (t) => /\bmoto ?gp\b/.test(t) && /\b(racing|race|grand prix|qualifying|sprint)\b/.test(t),
    },
  },
  pt: {
    sep: /^(.+?)\s+(?:x|vs\.?|\/)\s+(.+)$/i,
    competitions: [
      FOOT(4328, /^premier league\b/),
      FOOT(4480, /^(uefa )?champions league\b|^liga dos campeoes\b/),
      FOOT(4481, /^(uefa )?liga europa\b/),
      FOOT(4490, /^(uefa )?liga das nacoes\b/),
      FOOT(4501, /^(conmebol )?(copa )?libertadores\b/),
      FOOT(4562, /^amistoso internacional\b/, true),
      FOOT(4351, /^(campeonato brasileiro|brasileirao)\b/),
      // "NFL Redzone" jumps between every game at once: none of them.
      { sport: "nfl", league: 4391, test: /^nfl\b(?! redzone)/ },
      { sport: "nba", league: 4387, test: /^nba\b/ },
    ],
    races: { f1: (t) => /\bformula 1\b/.test(t) && /\b(gp|grande premio)\b/.test(t), motogp: (t) => /^motogp\b/.test(t) && /\b(gp|grande premio)\b/.test(t) },
  },
};
/** Not the side we follow, whatever the names: women's, youth and under-21 games. */
const OTHER_TEAM = /\b(feminin\w*|women|womens|u\d\d|sub \d\d|espoirs|jeunes|youth)\b/;
/** Not the competition we follow either: another confederation's, or a magazine about it. */
const OTHER_COMPETITION = /\b(caf|afc|concacaf|highlights?|stories|countdown|resumo|melhores momentos)\b/;
/** A live marker around a title: "Live: NFL Football", "São Paulo x Santos - Ao Vivo". */
const cleanTitle = (t) => String(t || "").replace(/^\s*(live|ao vivo|en direct)\s*:\s*/i, "").replace(/\s+-\s+(ao vivo|live|en direct)\s*$/i, "");

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
    .map((e) => ({ e, slots: slots(e), home: teamWords(e.home?.name), away: teamWords(e.away?.name), nicknames: NICKNAMED.has(e.sport) }));
}

/** "Levante / FC Barcelone", "Knicks at 76ers", "Flamengo x Palmeiras", in a title or a sub-title, as two sets of English words. */
function pairs(vocab, lang, ...texts) {
  const out = [];
  for (const t of texts) {
    for (const part of String(t || "").split(/[|:]/)) {
      const m = vocab.sep.exec(part.trim());
      if (m) out.push([m[1], m[2].split(/\.\s/)[0]].map((side) => new Set(english(side, lang).split(" ").filter(Boolean))));
    }
  }
  return out;
}

/** 2 when a side is the team exactly, 1 when it contains the team's words, 0 otherwise. */
function fits(side, words) {
  if (!words.length || !words.every((w) => side.has(w))) return 0;
  return side.size === words.length ? 2 : 1;
}

/** American leagues, where "Commanders at Colts" names two teams in full. */
const NICKNAMED = new Set(["nfl", "nba"]);

function teamScore(x, [a, b]) {
  const fit = (side, words) => fits(side, words) || (x.nicknames && words.length > 1 && side.size === 1 && side.has(words.at(-1)) ? 1 : 0);
  const straight = Math.min(fit(a, x.home), fit(b, x.away)) && fit(a, x.home) + fit(b, x.away);
  const swapped = Math.min(fit(a, x.away), fit(b, x.home)) && fit(a, x.away) + fit(b, x.home);
  return Math.max(straight, swapped);
}

/** The ids of our events this programme shows live; usually none, at most one. */
export function matchProgramme(p, index, lang = "fr") {
  const t = Date.parse(p.start);
  if (!Number.isFinite(t)) return [];
  const vocab = VOCAB[lang] || VOCAB.fr;
  const title = cleanTitle(p.title);
  if (OTHER_TEAM.test(fold(`${title} ${p.subTitle} ${(p.categories || []).join(" ")}`))) return [];
  const within = (before) => index.filter((x) => x.slots.some((k) => t >= k - before && t <= k + AFTER));
  const sides = pairs(vocab, lang, title, p.subTitle);
  if (sides.length) {
    const scored = within(BEFORE_NAMED).filter((x) => x.e.kind !== "race").map((x) => ({ x, score: Math.max(...sides.map((s) => teamScore(x, s))) }));
    const best = Math.max(0, ...scored.map((s) => s.score));
    const winners = scored.filter((s) => best > 0 && s.score === best);
    return winners.length === 1 ? [winners[0].x.e.id] : [];
  }
  const near = within(BEFORE);
  if (!near.length) return [];
  const text = fold(`${title} ${p.subTitle}`);
  const race = Object.keys(vocab.races).find((sport) => vocab.races[sport](text));
  if (race) return near.filter((x) => x.e.sport === race).map((x) => x.e.id).slice(0, 1);
  const folded = fold(title);
  if (OTHER_COMPETITION.test(folded)) return [];
  const comp = vocab.competitions.find((c) => c.test.test(folded));
  if (!comp) return [];
  const only = near.filter((x) => x.e.sport === comp.sport && String(x.e.league?.id) === String(comp.league));
  if (only.length === 1 && !comp.named) return [only[0].e.id];
  return namedIn(p.desc, only, lang);
}

/**
 * Several games of the competition at that hour, and a title naming none:
 * the description usually opens on the game shown — "La Croatie accueille
 * l'Angleterre…", then "on jouera également Islande/Bulgarie" (Julien,
 * build 34: the Nations League and the NBA had no channel). The game whose
 * two sides are both named soonest is the one; none named, no guess.
 */
function namedIn(desc, candidates, lang) {
  const words = english(desc || "", lang).split(" ");
  if (words.length < 2) return [];
  // Where a side is first named in full, and where a game is: once both
  // sides are. "…face à la Belgique, l'Italie… en Turquie… au Stade de
  // France" is Italy v Turkey, not France v Belgium.
  // A one-word side is not found inside another side's longer name:
  // "Irlande du Nord" names Northern Ireland, not Ireland (review, build 34).
  const covered = new Set();
  for (const side of candidates.flatMap((x) => [x.home, x.away]).filter((w) => w.length > 1)) {
    for (let i = 0; i + side.length <= words.length; i++) {
      if (side.every((w, k) => words[i + k] === w)) side.forEach((_, k) => covered.add(i + k));
    }
  }
  const at = (side) => {
    if (!side.length) return -1;
    if (side.length === 1) return words.findIndex((w, i) => w === side[0] && !covered.has(i));
    return side.every((w) => words.includes(w)) ? Math.max(...side.map((w) => words.indexOf(w))) : -1;
  };
  const named = candidates
    .map((x) => ({ x, home: at(x.home), away: at(x.away) }))
    .filter((c) => c.home >= 0 && c.away >= 0)
    .map((c) => ({ x: c.x, at: Math.max(c.home, c.away) }))
    .sort((a, b) => a.at - b.at);
  return named.length ? [named[0].x.e.id] : [];
}
