/**
 * How team names are compared across languages: a guide's "Naples",
 * "Alemanha" or "United States" against the English names our feeds use.
 * The channels themselves are in src/tv-channels.js.
 */

/** Lower case, no accents, punctuation as spaces: "Paris-SG" -> "paris sg". */
export function fold(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();
}

/**
 * Guide names -> the English ones our feeds use, per language. Phrases,
 * folded, replaced as whole words, longest first. Extend as games turn up
 * unmatched.
 */
const FRENCH = {
  naples: "napoli", fribourg: "freiburg", breme: "bremen", augsbourg: "augsburg", hambourg: "hamburg", mayence: "mainz",
  cologne: "koln", "bayern munich": "bayern munich", bayern: "bayern munich",
  barcelone: "barcelona", seville: "sevilla", majorque: "mallorca", "la corogne": "deportivo la coruna",
  rome: "roma", lisbonne: "lisbon", "paris sg": "paris saint germain", psg: "paris saint germain",
  turin: "", "betis seville": "real betis", "fc seville": "sevilla",
  belgique: "belgium", angleterre: "england", espagne: "spain", allemagne: "germany", italie: "italy",
  "pays bas": "netherlands", croatie: "croatia", "etats unis": "usa", bresil: "brazil", ecosse: "scotland",
  "irlande du nord": "northern ireland", irlande: "ireland", "pays de galles": "wales", suisse: "switzerland",
  danemark: "denmark", norvege: "norway", autriche: "austria", pologne: "poland", suede: "sweden",
  mexique: "mexico", japon: "japan", "coree du sud": "south korea", australie: "australia", maroc: "morocco",
  egypte: "egypt", argentine: "argentina", colombie: "colombia", chili: "chile", equateur: "ecuador",
  perou: "peru", serbie: "serbia", grece: "greece", turquie: "turkey", hongrie: "hungary",
  "republique tcheque": "czech republic", tchequie: "czech republic", roumanie: "romania",
  slovaquie: "slovakia", slovenie: "slovenia", finlande: "finland", islande: "iceland", georgie: "georgia",
  armenie: "armenia", lituanie: "lithuania", lettonie: "latvia", estonie: "estonia",
  "bosnie herzegovine": "bosnia and herzegovina", "macedoine du nord": "north macedonia", albanie: "albania",
  bielorussie: "belarus", chypre: "cyprus", moldavie: "moldova", azerbaidjan: "azerbaijan", bulgarie: "bulgaria",
  malte: "malta", andorre: "andorra", "iles feroe": "faroe islands", "saint marin": "san marino",
};
/** Brazilian guides: nations, and clubs as Globo and ESPN abbreviate them ("Atlético-MG"). */
const PORTUGUESE = {
  alemanha: "germany", inglaterra: "england", espanha: "spain", franca: "france", italia: "italy", belgica: "belgium",
  holanda: "netherlands", "paises baixos": "netherlands", croacia: "croatia", "estados unidos": "usa", brasil: "brazil",
  escocia: "scotland", "irlanda do norte": "northern ireland", irlanda: "ireland", "pais de gales": "wales",
  suica: "switzerland", dinamarca: "denmark", noruega: "norway", polonia: "poland", suecia: "sweden",
  mexico: "mexico", japao: "japan", "coreia do sul": "south korea", marrocos: "morocco", egito: "egypt",
  equador: "ecuador", uruguai: "uruguay", paraguai: "paraguay", servia: "serbia", grecia: "greece", turquia: "turkey",
  hungria: "hungary", "republica tcheca": "czech republic", tchequia: "czech republic", romenia: "romania",
  eslovaquia: "slovakia", eslovenia: "slovenia", finlandia: "finland", islandia: "iceland", lituania: "lithuania",
  letonia: "latvia", estonia: "estonia", "bosnia e herzegovina": "bosnia herzegovina", "macedonia do norte": "north macedonia",
  bielorrussia: "belarus", chipre: "cyprus", moldavia: "moldova", azerbaijao: "azerbaijan", bulgaria: "bulgaria",
  "ilhas faroe": "faroe islands", "sao marino": "san marino", cazaquistao: "kazakhstan", ucrania: "ukraine",
  "africa do sul": "south africa", gana: "ghana", "burkina faso": "burkina faso", comores: "comoros", benin: "benin",
  russia: "russia", uzbequistao: "uzbekistan", india: "india", canada: "canada",
  "atletico mg": "atletico mineiro", "athletico pr": "athletico paranaense", vasco: "vasco da gama",
  "vasco da gama": "vasco da gama", "red bull bragantino": "bragantino", "rb bragantino": "bragantino",
};
/** American guides already write English; only a few names differ from our feeds'. */
const ENGLISH = {
  "united states": "usa", usmnt: "usa", czechia: "czech republic", turkiye: "turkey", "korea republic": "south korea",
};
const NAMES = { fr: FRENCH, pt: PORTUGUESE, en: ENGLISH };
const PHRASES = Object.fromEntries(Object.entries(NAMES).map(([lang, dict]) => [lang, Object.keys(dict).sort((a, b) => b.length - a.length)]));

/** A folded side of a guide title with its names put into our feeds' English. */
export function english(side, lang = "fr") {
  const dict = NAMES[lang] || {};
  const phrases = PHRASES[lang] || [];
  let s = ` ${fold(side)} `;
  // One pass over the original words: a replacement is never translated twice.
  const out = [];
  while (s.trim()) {
    const hit = phrases.find((p) => s.startsWith(` ${p} `));
    const word = hit || s.trim().split(" ")[0];
    out.push(hit ? dict[hit] : word);
    s = s.slice(word.length + 1);
  }
  return out.filter(Boolean).join(" ");
}

/** Words that name no club in particular. */
const GENERIC = new Set(["fc", "cf", "ac", "as", "sc", "afc", "ssc", "sv", "vfl", "vfb", "tsg", "fsv", "rb", "ogc", "rc", "us", "real", "borussia", "werder", "club", "de", "the"]);

/** The words that pick a team out: "Borussia Dortmund" -> ["dortmund"], "Mainz 05" -> ["mainz"]. */
export function teamWords(name) {
  // Our feed spells one nation "N.Ireland", which no guide does.
  return fold(name).replace(/^n ireland$/, "northern ireland").split(" ").filter((w) => w && !GENERIC.has(w) && !/^\d+$/.test(w));
}
