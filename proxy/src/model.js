/**
 * The one shape the app reads. Every provider normalises into this.
 *
 * Team event:
 *   { id, sport, league: {id, name, short}, kind: "match", start (ISO UTC), round,
 *     status: { state: "scheduled"|"live"|"final"|"other", clock, detail },
 *     home: { name, short }, away: { name, short }, score: { home, away } }
 * Race event:
 *   { id, sport: "f1", league, kind: "race", start, name, circuit, country,
 *     status: {...}, results: [{ pos, driver, code, nationality, team, gap }] }
 */

/**
 * 3-letter code when the provider gives none.
 * "Paris Saint Germain" -> PSG, "Detroit Lions" -> DET, "Cardinals" -> CAR.
 * Ambiguous cases (Manchester City / United) are fixed by the overrides table.
 */
export function shortName(name) {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean);
  if (words.length >= 3) return words.map((w) => w[0]).join("").slice(0, 3).toUpperCase();
  if (words.length === 2) return words[0].slice(0, 3).toUpperCase();
  return name.slice(0, 3).toUpperCase();
}

/** Hand-kept codes where the rule above is wrong or ambiguous. Extend as leagues are added. */
const OVERRIDES = {
  "Manchester City": "MCI", "Manchester United": "MUN", "Real Madrid": "RMA", "Atletico Madrid": "ATM",
  "Inter": "INT", "AC Milan": "MIL", "Tottenham": "TOT", "Borussia Dortmund": "BVB", "Bayer Leverkusen": "LEV",
  "Tampa Bay Buccaneers": "TB", "Green Bay Packers": "GB", "Kansas City Chiefs": "KC", "New England Patriots": "NE",
  "New Orleans Saints": "NO", "New York Giants": "NYG", "New York Jets": "NYJ", "Los Angeles Rams": "LAR",
  "Los Angeles Chargers": "LAC", "Las Vegas Raiders": "LV", "San Francisco 49ers": "SF", "Jacksonville Jaguars": "JAX",
};

/** US teams are shown by nickname ("Lions"); clubs by their full name. */
export function nickname(name) {
  const words = name.split(/\s+/);
  return words.length >= 2 && /^[A-Z0-9]/.test(words.at(-1)) && !/^(FC|SC|CF|AC|United|City)$/.test(words.at(-1)) ? words.at(-1) : name;
}

export function team(name, code, { nick = false, logo } = {}) {
  return { name, short: code || OVERRIDES[name] || shortName(name), nick: nick ? nickname(name) : name, logo: logo || undefined };
}

const NATIONALITY_ISO = {
  Italian: "IT", Dutch: "NL", British: "GB", Spanish: "ES", Monegasque: "MC", Australian: "AU", Mexican: "MX",
  Canadian: "CA", French: "FR", German: "DE", Finnish: "FI", Danish: "DK", Thai: "TH", Japanese: "JP", Chinese: "CN",
  American: "US", Brazilian: "BR", Argentine: "AR", "New Zealander": "NZ", Swiss: "CH", Belgian: "BE", Austrian: "AT",
  Russian: "RU", Polish: "PL", Swedish: "SE", Irish: "IE", Colombian: "CO", Indonesian: "ID", Venezuelan: "VE",
};

const ISO3_TO_2 = {
  ita: "IT", esp: "ES", usa: "US", gbr: "GB", fra: "FR", ger: "DE", deu: "DE", srb: "RS", rus: "RU", aus: "AU", can: "CA",
  arg: "AR", bra: "BR", chi: "CL", chl: "CL", col: "CO", mex: "MX", jpn: "JP", chn: "CN", kor: "KR", ind: "IN", kaz: "KZ",
  blr: "BY", ukr: "UA", pol: "PL", cze: "CZ", svk: "SK", hun: "HU", rou: "RO", bul: "BG", gre: "GR", tur: "TR", sui: "CH",
  che: "CH", aut: "AT", ned: "NL", nld: "NL", bel: "BE", den: "DK", dnk: "DK", nor: "NO", swe: "SE", fin: "FI", por: "PT",
  prt: "PT", cro: "HR", hrv: "HR", slo: "SI", svn: "SI", bih: "BA", geo: "GE", egy: "EG", rsa: "ZA", zaf: "ZA", tun: "TN",
  mar: "MA", uzb: "UZ", tpe: "TW", tha: "TH", ina: "ID", idn: "ID", nzl: "NZ", per: "PE", ecu: "EC", uru: "UY", ven: "VE",
  bol: "BO", par: "PY", dom: "DO", isr: "IL", lat: "LV", ltu: "LT", est: "EE", mda: "MD", lux: "LU", mon: "MC", mco: "MC",
};

/** "ita" -> "🇮🇹" from an ISO-3166 alpha-3 (IOC style) code. */
export function flagIso3(code) {
  const iso = ISO3_TO_2[String(code || "").toLowerCase()];
  return iso ? [...iso].map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join("") : undefined;
}

/** "ES" -> "🇪🇸" from an ISO-3166 alpha-2 code; undefined when unknown. */
export function flagIso2(code) {
  const iso = String(code || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(iso)) return undefined;
  return [...iso].map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join("");
}

/** "Italian" -> "🇮🇹" (regional indicator pair); undefined when unknown. */
export function flag(nationality) {
  const iso = NATIONALITY_ISO[nationality];
  if (!iso) return undefined;
  return [...iso].map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join("");
}

export const STATE = { scheduled: "scheduled", live: "live", final: "final", other: "other" };

/** File-name form of a team name. Must match slug() in scripts/build-team-badges.py. */
export function slug(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
