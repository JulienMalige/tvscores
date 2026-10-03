/**
 * Names for where a game airs: the channels we read per country, how the
 * feeds spell them, and how team names are compared across languages.
 * Names only — rule 4: never a link, never a logo.
 */

const range = (from, to, id, name) => Array.from({ length: to - from + 1 }, (_, i) => [id(from + i), name(from + i)]);

/**
 * XMLTV channel id -> the name we show. Only national French sports outlets
 * and the free channels that carry big games; Belgian and Swiss channels in
 * the same file (RTS, Tipik, RTL TVI, La Une) are left out on purpose.
 */
const CHANNELS_FR = Object.fromEntries([
  ...range(1, 3, (n) => `beINSPORTS${n}.fr`, (n) => `beIN Sports ${n}`),
  ...range(4, 10, (n) => `beINSPORTSMAX${n}.fr`, (n) => `beIN Sports Max ${n}`),
  ["CanalPlus.fr", "Canal+"],
  ["CanalPlusFoot.fr", "Canal+ Foot"],
  ["CanalPlusSport.fr", "Canal+ Sport"],
  ["CanalPlusSport360.fr", "Canal+ Sport 360"],
  ["CanalPlusPremierLeague.fr", "Canal+ Premier League"],
  ["CanalPlusLigue1.fr", "Canal+ Ligue 1"],
  ["Ligue1Plus.fr", "Ligue 1+"],
  ...range(2, 10, (n) => `Ligue1Plus${n}.fr`, (n) => `Ligue 1+ ${n}`),
  ["DAZN.fr", "DAZN 1"],
  ["DAZN2.fr", "DAZN 2"],
  ["TF1.fr", "TF1"],
  ["France2.fr", "France 2"],
  ["France3.fr", "France 3"],
  ["France4.fr", "France 4"],
  ["M6.fr", "M6"],
  ["W9.fr", "W9"],
  ["LEquipe21.fr", "L'Équipe"],
  ["RMCSport1.fr", "RMC Sport 1"],
  ["RMCSport2.fr", "RMC Sport 2"],
  ["Eurosport1.fr", "Eurosport 1"],
  ["Eurosport2.fr", "Eurosport 2"],
]);

/**
 * Per country: the name TheSportsDB files its TV rows under, and the XMLTV
 * guide with the channels we keep from it. Another country is another entry
 * here plus its own `broadcasts-<cc>.json` rights table.
 */
export const COUNTRIES = {
  FR: { tsdb: "France", xmltv: "https://xmltvfr.fr/xmltv/xmltv_fr.xml.gz", channels: CHANNELS_FR },
};

/**
 * TheSportsDB's spelling -> ours: "BeIn Sports HD 1 France" -> "beIN Sports 1",
 * "Ligue 1+ 2 FR" -> "Ligue 1+ 2", "Canal+ France" -> "Canal+". Anything that
 * carries a link comes back empty.
 */
export function tsdbChannelName(raw) {
  const name = String(raw || "").trim();
  if (!name || /https?:|www\./i.test(name)) return "";
  return name
    .replace(/\s+(France|FR)$/i, "")
    .replace(/\bHD\b/g, "")
    .replace(/^bein\s+sports/i, "beIN Sports")
    .replace(/^Ligue 1\+ 1$/, "Ligue 1+")
    .replace(/\s+/g, " ")
    .trim();
}

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
 * French names in the guide -> the English ones our feeds use. Phrases, folded,
 * replaced as whole words, longest first. Extend as games turn up unmatched.
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
const PHRASES = Object.keys(FRENCH).sort((a, b) => b.length - a.length);

/** A folded side of a guide title with its French names put into English. */
export function english(side) {
  let s = ` ${fold(side)} `;
  // One pass over the original words: a replacement is never translated twice.
  const out = [];
  while (s.trim()) {
    const hit = PHRASES.find((p) => s.startsWith(` ${p} `));
    const word = hit || s.trim().split(" ")[0];
    out.push(hit ? FRENCH[hit] : word);
    s = s.slice(word.length + 1);
  }
  return out.filter(Boolean).join(" ");
}

/** Words that name no club in particular. */
const GENERIC = new Set(["fc", "cf", "ac", "as", "sc", "afc", "ssc", "sv", "vfl", "vfb", "tsg", "fsv", "rb", "ogc", "rc", "us", "real", "borussia", "werder", "club", "de", "the"]);

/** The words that pick a team out: "Borussia Dortmund" -> ["dortmund"], "Mainz 05" -> ["mainz"]. */
export function teamWords(name) {
  return fold(name).split(" ").filter((w) => w && !GENERIC.has(w) && !/^\d+$/.test(w));
}
