/**
 * The channels we read per country: the XMLTV ids we keep and the names we
 * show, and how TheSportsDB spells the same channels. Names only: no link
 * and no logo is passed on (opening an official app is a roadmap item,
 * docs/roadmap.md).
 */

const range = (from, to, id, name) => Array.from({ length: to - from + 1 }, (_, i) => [id(from + i), name(from + i)]);

/**
 * XML TV Fr: national French sports outlets and the free channels that
 * carry big games; Belgian and Swiss channels in the same file (RTS, Tipik,
 * RTL TVI, La Une) are left out on purpose.
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
 * epgshare01's US guide: the national networks' East feeds and the national
 * sports networks. Regional sports networks, Pacific feeds (the same games,
 * listed twice) and college-only channels are left out. FOX's broadcast
 * network is not in this file (only in the 60 MB locals one): TheSportsDB
 * and the rights table cover it.
 */
const CHANNELS_US = {
  "ESPN.HD.us2": "ESPN",
  "ESPN2.HD.us2": "ESPN2",
  "ESPN.Deportes.HD.us2": "ESPN Deportes",
  "ABC.National.Feed.us2": "ABC",
  "CBS.Streaming.SD.East.feed.us2": "CBS",
  "NBC.East.Stream.us2": "NBC",
  "FS1.Fox.Sports.1.HD.us2": "FS1",
  "FS2.Fox.Sports.2.HD.us2": "FS2",
  "Fox.Soccer.Plus.HD.us2": "Fox Soccer Plus",
  "Fox.Deportes.HD.us2": "Fox Deportes",
  "CBS.Sports.Network.HD.us2": "CBS Sports Network",
  "CBS.Sports.Golazo.Network.us2": "CBS Sports Golazo",
  "TNT.HD.us2": "TNT",
  "TBS.HD.us2": "TBS",
  "truTV.HD.us2": "truTV",
  "NBA.TV.HD.us2": "NBA TV",
  "NFL.Network.HD.us2": "NFL Network",
  "Golf.Channel.HD.us2": "Golf Channel",
  "Tennis.Channel.HD.us2": "Tennis Channel",
  "beIN.Sports.USA.HD.us2": "beIN Sports",
  "beIN.Sports.En.Español.HD.us2": "beIN Sports en Español",
  "USA.Network.HD.us2": "USA Network",
  "Telemundo.Satellite.Feed.us2": "Telemundo",
  "UNIVERSO.HD.us2": "Universo",
  "Univision.Network.HD.us2": "Univision",
  "UniMas.us2": "UniMás",
  "TUDN.us2": "TUDN",
};

/**
 * epgshare01's second Brazilian guide (national feeds, unlike the first,
 * which is São Paulo's cable lineup with Globo and Premiere left empty).
 * Premiere's other channels and Disney+ are not in it.
 */
const CHANNELS_BR = {
  "Globo.br": "Globo",
  "SporTV.br": "SporTV",
  "SporTV.2.br": "SporTV 2",
  "SporTV.3.br": "SporTV 3",
  "Premiere.Clubes.br": "Premiere",
  ...Object.fromEntries([["ESPN.br", "ESPN"], ...range(2, 5, (n) => `ESPN.${n}.br`, (n) => `ESPN ${n}`)]),
  "Band.br": "Band",
  "Band.Sports.br": "BandSports",
  "TNT.br": "TNT",
  "Record.TV.br": "Record",
  "SBT.br": "SBT",
};

/**
 * Per country: the name TheSportsDB files its TV rows under, the XMLTV guide
 * with the channels we keep from it, and the language its listings are
 * written in (src/tv-match.js). Another country is another entry here plus
 * its own `broadcasts-<cc>.json` rights table.
 */
export const COUNTRIES = {
  FR: { tsdb: "France", xmltv: "https://xmltvfr.fr/xmltv/xmltv_fr.xml.gz", lang: "fr", channels: CHANNELS_FR },
  US: { tsdb: "United States", xmltv: "https://epgshare01.online/epgshare01/epg_ripper_US2.xml.gz", lang: "en", channels: CHANNELS_US },
  BR: { tsdb: "Brazil", xmltv: "https://epgshare01.online/epgshare01/epg_ripper_BR2.xml.gz", lang: "pt", channels: CHANNELS_BR },
};

/** TheSportsDB rows that name no national channel: a subscription package, a regional network, a local station. */
const NOT_NATIONAL = /^(nfl sunday ticket|facebook|mlb\.tv|nesn|yes|spectrum|msg|marquee|nbc sports (philadelphia|california|bay area|boston|chicago|washington))\b|\bonly\)/i;
const CALL_SIGN = /^[KW][A-Z]{2,3}\b/;

/** Their spelling -> ours, once the country suffix is gone; then each country's own. */
const RENAME = [
  [/^bein\s+sports/i, "beIN Sports"],
  [/^Ligue 1\+ 1$/, "Ligue 1+"],
  [/^Amazon Prime Video$/i, "Prime Video"],
  [/^ESPN \+$/, "ESPN+"],
  [/^Max$/, "HBO Max"],
  [/^Apple TV\+$/, "Apple TV"],
  [/^Canais Globo$/, "Globo"],
  [/^CBS Sports Network USA$/, "CBS Sports Network"],
];
const RENAME_BY = {
  US: [[/^Fox Sports 1$/i, "FS1"], [/^Fox Sports 2$/i, "FS2"], [/^ESPN 2$/, "ESPN2"]],
  // TheSportsDB still files ESPN 4 under its old name, Fox Sports: the same
  // games (Switzerland v Slovenia, the MLB play-offs) are on ESPN 4 in the
  // guide, 2026-10-03.
  BR: [[/^Fox Sports 1$/i, "ESPN 4"]],
};

/**
 * TheSportsDB's spelling -> ours: "BeIn Sports HD 1 France" -> "beIN Sports 1",
 * "Fox Sports 1 HD US" -> "FS1", "ESPN Brasil" -> "ESPN". Anything that
 * carries a link, and any channel that is not national, comes back empty.
 */
export function tsdbChannelName(raw, country = "FR") {
  const trimmed = String(raw || "").trim();
  if (!trimmed || /https?:|www\./i.test(trimmed) || NOT_NATIONAL.test(trimmed) || CALL_SIGN.test(trimmed)) return "";
  const name = trimmed
    .replace(/\s+(France|FR|US|USA|Brasil|Brazil|BR)$/i, "")
    .replace(/\bHD\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return [...RENAME, ...(RENAME_BY[country] || [])].reduce((n, [re, ours]) => n.replace(re, ours), name);
}
