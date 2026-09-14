import { createHash } from "node:crypto";
import { mkdirSync, existsSync, readFileSync, writeFileSync, unlinkSync, renameSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MAX_BYTES = 3 << 20;
const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };
const DAY = 86400e3;

/**
 * Local mirror of the crests and player portraits that live on other people's
 * CDNs. Those images change once in a blue moon, so the Apple TV should ask
 * this proxy for them once and then never again: one host, one connection, and
 * a cache header long enough that the television keeps them.
 *
 * A URL is registered the moment it appears in a response; the bytes are
 * fetched in the background, or on the first request if that beats the warmer.
 * When an upstream fetch fails the request is redirected to the original URL,
 * so a picture is never lost just because the mirror is cold.
 */
export class ImageMirror {
  constructor({ dir, publicBase = "", log = () => {}, fetchImpl = fetch, maxAgeDays = 60, refreshDays = 30, timeoutMs = 20000 }) {
    this.timeoutMs = timeoutMs;
    this.dir = dir;
    this.publicBase = publicBase;
    this.log = log;
    this.fetchImpl = fetchImpl;
    this.maxAge = maxAgeDays * DAY;
    this.refreshAfter = refreshDays * DAY;
    this.entries = new Map(); // key -> { url, type, ext, bytes, fetchedAt, lastUsed, fails }
    this.inFlight = new Map();
    this.dirty = false;
    this.timer = null;
    mkdirSync(this.dir, { recursive: true });
    this.#load();
  }

  static key(url) {
    return createHash("sha1").update(url).digest("hex");
  }

  get manifestPath() {
    return join(this.dir, "index.json");
  }

  #load() {
    try {
      const raw = JSON.parse(readFileSync(this.manifestPath, "utf8"));
      for (const [key, entry] of Object.entries(raw.images || {})) this.entries.set(key, entry);
    } catch {
      /* first run, or a manifest we can rebuild by re-registering URLs */
    }
  }

  save() {
    if (!this.dirty) return;
    const body = JSON.stringify({ images: Object.fromEntries(this.entries) });
    const tmp = `${this.manifestPath}.tmp`;
    writeFileSync(tmp, body);
    renameSync(tmp, this.manifestPath);
    this.dirty = false;
  }

  file(key) {
    const entry = this.entries.get(key);
    // Only extensions we chose ourselves; never a string from the manifest.
    if (!entry?.ext || !Object.values(EXT).includes(entry.ext)) return null;
    return join(this.dir, `${key}.${entry.ext}`);
  }

  /** Public URL for an upstream image, registering it for mirroring. */
  url(original) {
    if (!original) return undefined;
    if (this.publicBase && original.startsWith(this.publicBase)) return original; // already ours
    const key = ImageMirror.key(original);
    const entry = this.entries.get(key);
    if (entry) {
      // Naming it counts as using it: the television caches these for a month,
      // so "nobody asked recently" is not the same as "nobody needs it".
      entry.lastUsed = Date.now();
    } else {
      this.entries.set(key, { url: original, fetchedAt: 0, lastUsed: Date.now(), fails: 0 });
    }
    this.dirty = true;
    return `${this.publicBase}/v1/img/${key}`;
  }

  /** Download one image. Resolves to true when the bytes are on disk. */
  async fetchOne(key) {
    const entry = this.entries.get(key);
    if (!entry) return false;
    if (this.inFlight.has(key)) return this.inFlight.get(key);
    const job = (async () => {
      try {
        // Without a deadline a hung CDN socket would keep this key in flight
        // for ever, and serve() waits on it.
        const ctrl = new AbortController();
        const deadline = setTimeout(() => ctrl.abort(), this.timeoutMs);
        let res;
        try {
          res = await this.fetchImpl(entry.url, { redirect: "follow", signal: ctrl.signal });
        } finally {
          clearTimeout(deadline);
        }
        if (!res.ok) throw new Error(`status ${res.status}`);
        const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
        const ext = EXT[type];
        if (!ext) throw new Error(`content-type ${type || "missing"}`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (!buf.length) throw new Error("empty body");
        if (buf.length > MAX_BYTES) throw new Error(`${buf.length} bytes`);
        const old = this.file(key);
        const target = join(this.dir, `${key}.${ext}`);
        const tmp = `${target}.tmp`;
        writeFileSync(tmp, buf);
        renameSync(tmp, target);
        if (old && old !== target) { try { unlinkSync(old); } catch { /* gone */ } }
        Object.assign(entry, { type, ext, bytes: buf.length, fetchedAt: Date.now(), fails: 0 });
        this.dirty = true;
        return true;
      } catch (err) {
        entry.fails = (entry.fails || 0) + 1;
        entry.lastError = String(err.message || err);
        this.dirty = true;
        this.log(`image miss ${entry.url} (${entry.lastError})`);
        return false;
      } finally {
        this.inFlight.delete(key);
      }
    })();
    this.inFlight.set(key, job);
    return job;
  }

  /**
   * What to answer for GET /v1/img/<key>: the bytes, a redirect to the
   * original when we cannot mirror it, or null when the key is unknown.
   */
  async serve(key) {
    const entry = this.entries.get(key);
    if (!entry) return null;
    entry.lastUsed = Date.now();
    this.dirty = true;
    const path = this.file(key);
    if (path && existsSync(path)) return { body: readFileSync(path), type: entry.type, etag: key };
    if (await this.fetchOne(key)) {
      const fresh = this.file(key);
      if (fresh && existsSync(fresh)) return { body: readFileSync(fresh), type: entry.type, etag: key };
    }
    return { redirect: entry.url };
  }

  /** Keys still to fetch, missing ones first, then copies due a refresh. */
  pending(now = Date.now()) {
    const missing = [];
    const stale = [];
    for (const [key, entry] of this.entries) {
      const path = this.file(key);
      // Back off on a URL that keeps failing, whether it is a first fetch or a
      // refresh, so a handful of dead links cannot eat every pass.
      if ((entry.fails || 0) >= 5) continue;
      if (!path || !existsSync(path)) missing.push(key);
      else if (now - (entry.fetchedAt || 0) > this.refreshAfter) stale.push(key);
    }
    // Images we have never had come first; refreshing a copy we can already
    // serve can wait.
    return [...missing, ...stale];
  }

  /** Fetch a few pending images. Returns how many landed. */
  async warm(limit = 6) {
    const keys = this.pending().slice(0, limit);
    if (!keys.length) return 0;
    const done = await Promise.all(keys.map((k) => this.fetchOne(k)));
    this.save();
    return done.filter(Boolean).length;
  }

  startWarming(intervalMs = 20000) {
    if (this.timer) return;
    const tick = async () => {
      await this.warm();
      this.save();
    };
    this.timer = setInterval(tick, intervalMs);
    if (this.timer.unref) this.timer.unref();
    tick();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.save();
  }

  /** Drop images nothing has asked for in a long while. */
  prune(now = Date.now()) {
    let dropped = 0;
    for (const [key, entry] of [...this.entries]) {
      if (now - (entry.lastUsed || 0) <= this.maxAge) continue;
      const path = this.file(key);
      if (path) { try { unlinkSync(path); } catch { /* already gone */ } }
      this.entries.delete(key);
      dropped++;
    }
    // Files with no manifest entry (a manifest lost or hand-edited) go too.
    const known = new Set([...this.entries.keys()]);
    for (const name of readdirSync(this.dir)) {
      if (name === "index.json" || name.endsWith(".tmp")) continue;
      if (!known.has(name.replace(/\.[a-z]+$/, ""))) {
        try { unlinkSync(join(this.dir, name)); dropped++; } catch { /* already gone */ }
      }
    }
    if (dropped) { this.dirty = true; this.save(); }
    return dropped;
  }

  stats() {
    let stored = 0;
    let bytes = 0;
    for (const [key, entry] of this.entries) {
      const path = this.file(key);
      if (path && existsSync(path)) { stored++; bytes += entry.bytes || 0; }
    }
    return { known: this.entries.size, stored, pending: this.entries.size - stored, megabytes: Math.round((bytes / 1e6) * 10) / 10 };
  }
}
