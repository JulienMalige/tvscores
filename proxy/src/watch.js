/**
 * How to Watch: from the channels a game is on, the apps that can show it.
 *
 * The table is hand-kept (`channel-apps.json`, with its rules written inside):
 * per country, a channel name maps to the apps that carry it. A game's cards
 * are those apps for the countries its channels are in, kept only when the app
 * has a tvOS version in that country (an iOS-only app cannot be opened from an
 * Apple TV), ordered by what the app is to the channel (its own, a streaming
 * service, a provider carrying many), at most four.
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

  /** { FR: ["canalplus", ...] } for a game's `broadcastsBy`: only countries with something to open. */
  function forEvent(broadcastsBy) {
    const out = {};
    for (const [country, names] of Object.entries(broadcastsBy || {})) {
      const seen = [];
      for (const name of names) for (const key of channelApps(country, name) || []) if (!seen.includes(key) && opens(key, country)) seen.push(key);
      const ordered = [...seen].sort((a, b) => KINDS.indexOf(table.apps[a].kind) - KINDS.indexOf(table.apps[b].kind)); // stable: the table's order within a kind
      if (ordered.length) out[country] = ordered.slice(0, MAX_CARDS);
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
