import { getJson } from "./http.js";

const WEEK = 7 * 86400e3;
const GAP = 3000; // Apple's lookup API is asked a few times a minute, not in a burst

/**
 * The icon of each app in the How to Watch table, from Apple's documented iTunes
 * Lookup API (the app's own store listing; nothing is bundled in the app, as with
 * the crests): the tvOS app's own icon, the wide one the Apple TV draws (512 x 307),
 * not the iPhone's square. One call per app, kept a week; the picture itself goes
 * through the image mirror like every other. A call is made only for an app with no icon yet or
 * a stale one, so a proxy with all of them asks nothing.
 */
export class AppIcons {
  constructor({ table, store, log = () => {}, fetch = getJson, now = () => Date.now() }) {
    Object.assign(this, { table, store, log, fetch, now });
    this.store.appIcons ??= {};
    this.timer = null;
  }

  /** The store id and country to ask for an app: its first id, in the first country it has a tvOS app in. */
  #target(app) {
    const id = typeof app.appStoreId === "number" ? app.appStoreId : Object.values(app.appStoreId || {})[0];
    const country = (app.tvos?.[0] || "US").toLowerCase();
    return id ? { id, country } : undefined;
  }

  /** The upstream address of an app's icon, or undefined. */
  get(key) {
    return this.store.appIcons[key]?.url;
  }

  due(now = this.now()) {
    // An icon kept from before the wide ones (no `tv`) is asked for again.
    return Object.keys(this.table.apps).filter((key) => this.#target(this.table.apps[key]) && !(this.store.appIcons[key]?.tv && now - this.store.appIcons[key].at < WEEK));
  }

  /** Ask for what is missing or stale; returns how many were fetched. */
  async fill(limit = Infinity) {
    let done = 0;
    for (const key of this.due().slice(0, limit)) {
      const { id, country } = this.#target(this.table.apps[key]);
      try {
        const { body } = await this.fetch(`https://itunes.apple.com/lookup?id=${id}&country=${country}&entity=tvSoftware`);
        const tv = (body?.results || []).find((r) => (r.supportedDevices || []).some((d) => /AppleTV/.test(d)));
        const url = (tv || body?.results?.[0])?.artworkUrl512 || (tv || body?.results?.[0])?.artworkUrl100;
        if (url) {
          this.store.appIcons[key] = { url, at: this.now(), tv: Boolean(tv) };
          this.store.touch();
          done += 1;
        } else {
          this.log(`app icon ${key}: no listing in ${country}`);
        }
      } catch (err) {
        this.log(`app icon ${key}: ${err.message}`);
      }
      if (done < limit) await new Promise((r) => setTimeout(r, GAP));
    }
    if (done) this.log(`app icons: ${done} fetched`);
    return done;
  }

  start() {
    const tick = async () => {
      await this.fill().catch((err) => this.log(`app icons: ${err.message}`));
      this.timer = setTimeout(tick, 86400e3); // nothing is asked unless something is due
      this.timer.unref?.();
    };
    this.timer = setTimeout(tick, 90e3);
    this.timer.unref?.();
  }

  stop() {
    clearTimeout(this.timer);
  }
}
