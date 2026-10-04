/**
 * How to Watch: from the channels a game is on, the apps that can show it.
 *
 * The table is hand-kept (`channel-apps.json`, with its rules written inside):
 * per country, a channel name maps to the apps that carry it. A game's cards
 * are those apps for the countries its channels are in, kept only when the app
 * has a tvOS version in that country (an iOS-only app cannot be opened from an
 * Apple TV), ordered by what the app is to the channel (its own, a streaming
 * service, a provider carrying many), at most four. A competition's own app,
 * the one with every game (NBA League Pass, NFL Game Pass), comes last, for each
 * country the table lists it in, and keeps the fourth place.
 */
const KINDS = ["own", "streamer", "provider"];
export const MAX_CARDS = 4;

export function createWatch(table) {
  /** A channel by its exact name, then without a trailing number ("ESPN 3"), then without "Max" ("beIN Sports Max 7"). */
  const channelApps = (country, name) => {
    const channels = table.channels[country];
    if (!channels) return undefined;
    const bare = name.replace(/\s+\d+$/, "");
    for (const n of [name, bare, bare.replace(/\s+Max$/, "")]) if (channels[n]) return channels[n];
    return undefined;
  };
  const opens = (key, country) => {
    const app = table.apps[key];
    return Boolean(app && (app.builtIn || app.tvos.includes(country)));
  };

  /** { FR: ["canalplus", ...] } for a game's `broadcastsBy` and its competition: only countries with something to open. */
  function forEvent(broadcastsBy, competitionId) {
    const complement = table.competitions?.[String(competitionId)]?.apps || {};
    const out = {};
    for (const country of new Set([...Object.keys(broadcastsBy || {}), ...Object.keys(complement)])) {
      const seen = [];
      for (const name of broadcastsBy?.[country] || []) for (const key of channelApps(country, name) || []) if (!seen.includes(key) && opens(key, country)) seen.push(key);
      const own = (complement[country] || []).filter((key) => opens(key, country));
      const ordered = [...seen].sort((a, b) => KINDS.indexOf(table.apps[a].kind) - KINDS.indexOf(table.apps[b].kind)); // stable: the table's order within a kind
      const cards = [...ordered.filter((k) => !own.includes(k)).slice(0, MAX_CARDS - own.length), ...own];
      if (cards.length) out[country] = cards;
    }
    return out;
  }

  /** What the television needs to draw and open a card: name, kind, App Store id (a number, or one per country), built in. */
  function describe(keys) {
    return Object.fromEntries([...keys].sort().map((key) => {
      const { name, kind, appStoreId, builtIn } = table.apps[key];
      return [key, { name, kind, id: appStoreId, ...(builtIn ? { builtIn: true } : {}) }];
    }));
  }

  return { forEvent, describe };
}
