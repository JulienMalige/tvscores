import { createServer } from "node:http";
import { readFileSync, statSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
import { buildScoreboard, localDate, withTablePhotos, withBroadcasts } from "./scoreboard.js";
import { slug } from "./model.js";
import { prepare, send, canonicalTz } from "./respond.js";
import { appendTrace, POSTS_PER_MIN } from "./trace.js";

/** Crests and portraits change once in a blue moon; let the TV keep them. */
const IMAGE_CACHE = "public, max-age=31536000, immutable"; // a year: a crest changes at a rebrand, and ImageMirror.VERSION is the lever

/** @param limits per-source daily caps ({ football: 100, f1: 200, photos: 1000, ... }), supplied by index.js from the actual quotas. */
export function createApp({ store, config, startedAt = Date.now(), photos, images, details, broadcasts, activeSports = [], limits = {}, log = () => {} }) {
  const broadcastsFor = broadcasts ? (e) => broadcasts.for(e) : undefined;
  const photoFor = photos ? (name) => photos.photoFor(name) : undefined;
  const mirror = images ? (url) => images.url(url) : undefined;
  // Constructor badges are files we shipped; list them once so a missing one
  // falls back to the monogram instead of a broken image.
  const teamBadges = new Set();
  for (const sport of readdirSync(join(ASSETS, "teams"), { withFileTypes: true }).filter((d) => d.isDirectory())) {
    for (const file of readdirSync(join(ASSETS, "teams", sport.name))) {
      if (file.endsWith(".png")) teamBadges.add(`${sport.name}/${file.slice(0, -4)}`);
    }
  }
  const badgeFor = (sport) => (name) => {
    const path = `${sport}/${slug(name)}`;
    return teamBadges.has(path) ? `${config.publicBase}/v1/assets/teams/${path}.png` : undefined;
  };
  // Answers built from the store, kept a few seconds: the board changes at most
  // every poll, not per request. Bounded, and a hit counts as a use, so no run of
  // odd requests can grow them or push the board out; the fixtures, which a
  // client can ask for by any date, have a memo of their own.
  const memoOf = (max, ttl) => {
    const held = new Map(); // key -> { at, prepared }
    return (key, build, ms = ttl) => {
      const hit = held.get(key);
      if (hit && Date.now() - hit.at < ms) {
        held.delete(key);
        held.set(key, hit);
        return hit.prepared;
      }
      const prepared = build();
      held.delete(key);
      held.set(key, { at: Date.now(), prepared });
      if (held.size > max) held.delete(held.keys().next().value);
      return prepared;
    };
  };
  const remember = memoOf(64, 15000);
  const rememberFixtures = memoOf(16, 15000);
  // Anything that is a key of ours or of a provider, to be scrubbed from what the health page says.
  const secrets = [config.theSportsDbKey, config.apiSportsKey, config.liveTennisKey, config.ocBlacktopKey].filter((k) => k && k.length > 6);
  const scrub = (value) => {
    if (value == null) return value;
    let text = JSON.stringify(value ?? null);
    for (const secret of secrets) text = text.split(secret).join("…");
    return JSON.parse(text);
  };
  let diagWindow = { at: 0, count: 0 };

  const handle = (req, res) => {
    let url;
    try {
      url = new URL(req.url, "http://localhost");
    } catch {
      return send(res, 400, { error: "bad url" });
    }
    let path = url.pathname;
    if (config.pathPrefix && path.startsWith(config.pathPrefix)) path = path.slice(config.pathPrefix.length) || "/";
    const rawTz = url.searchParams.get("tz") || "UTC";
    const tz = canonicalTz(rawTz);
    if (!tz) return send(res, 400, { error: `unknown tz ${rawTz.slice(0, 64)}` });

    if (path === "/v1/scoreboard") {
      const prepared = remember(`board|${tz}`, () => {
        const body = buildScoreboard(store.all(), { tz, sportOrder: config.sportOrder, meta: store.meta, leagues: config.leagues, publicBase: config.publicBase, standings: store.standings, photoFor, mirror, broadcastsFor, activeSports, upcomingDays: config.schedule.upcomingDays });
        // The tables' crests and portraits are registered with the mirror here
        // too, so the warmer has them before any television opens a table:
        // a crest first mirrored while a page waits for it is the one that
        // arrives late and is remembered as missing.
        if (mirror) for (const table of Object.entries(store.standings)) withTablePhotos(table[1], photoFor, mirror, badgeFor(table[0].split(":")[0]));
        // The tag is the content: generatedAt moves with every rebuild and is not a
        // change. A 304 stands for five minutes at most, so a television's idea of
        // "now", which it reads off generatedAt, is never older than that.
        return prepare(body, { tagOf: { ...body, generatedAt: undefined }, window: 5 * 60e3 });
      });
      return send(res, 200, undefined, {}, req, prepared);
    }
    if (path === "/v1/fixtures") {
      const date = url.searchParams.get("date");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return send(res, 400, { error: "date=YYYY-MM-DD required" });
      const prepared = rememberFixtures(`${tz}|${date}`, () => {
        const events = store.all().filter((e) => localDate(e.start, tz) === date).map((e) => withBroadcasts(e, broadcastsFor));
        return prepare({ date, tz, events });
      });
      return send(res, 200, undefined, {}, req, prepared);
    }
    if (path === "/v1/standings") {
      return send(res, 200, { standings: Object.fromEntries(Object.entries(store.standings).map(([k, v]) => [k, withTablePhotos(v, photoFor, mirror, badgeFor(k.split(":")[0]))])) });
    }
    // One game's page: its periods, statistics, goals and cards, records.
    if (path === "/v1/event") {
      const id = url.searchParams.get("id") || "";
      if (!details || !/^(football|nfl|nba):tsdb:\d+$/.test(id)) return send(res, 404, { error: "no detail for this game" });
      details.get(id).then((body) => (body ? send(res, 200, body, {}, req) : send(res, 404, { error: "unknown game" })))
        .catch(() => send(res, 502, { error: "detail fetch failed" }));
      return;
    }
    const one = path.match(/^\/v1\/standings\/([a-z0-9-]+)\/([a-z0-9-]+)$/);
    if (one) {
      const data = store.standings[`${one[1]}:${one[2]}`];
      return data ? send(res, 200, withTablePhotos(data, photoFor, mirror, badgeFor(one[1])), {}, req) : send(res, 404, { error: "no standings for this league" });
    }
    const img = path.match(/^\/v1\/img\/([0-9a-f]{40})$/);
    if (img && images) {
      if (req.headers["if-none-match"] === `"${img[1]}"` && images.entries.has(img[1])) {
        res.writeHead(304, { etag: `"${img[1]}"`, "cache-control": IMAGE_CACHE });
        return res.end();
      }
      images.serve(img[1]).then((hit) => {
        if (!hit) return send(res, 404, { error: "unknown image" });
        // Cold and unreachable: hand the television the original address
        // rather than a hole where a crest should be.
        if (hit.redirect) {
          res.writeHead(302, { location: hit.redirect, "cache-control": "public, max-age=60" });
          return res.end();
        }
        res.writeHead(200, { "content-type": hit.type, "content-length": hit.body.length, "cache-control": IMAGE_CACHE, etag: `"${hit.etag}"`, "access-control-allow-origin": "*" });
        res.end(hit.body);
      }).catch(() => send(res, 502, { error: "image fetch failed" }));
      return;
    }
    const team = path.match(/^\/v1\/assets\/teams\/([a-z0-9-]+)\/([a-z0-9-]+)\.png$/);
    if (team && teamBadges.has(`${team[1]}/${team[2]}`)) {
      const badge = readFileSync(join(ASSETS, "teams", team[1], `${team[2]}.png`));
      // A week, not for ever: these are files of ours at a fixed address, redrawn now and then.
      res.writeHead(200, { "content-type": "image/png", "content-length": badge.length, "cache-control": "public, max-age=604800", "access-control-allow-origin": "*" });
      return res.end(badge);
    }
    // A country's flag, flat and square, for the app to clip into a circle.
    const flag = path.match(/^\/v1\/assets\/flags\/([a-z]{2})\.png$/);
    if (flag) {
      const file = join(ASSETS, "flags", `${flag[1]}.png`);
      try {
        statSync(file);
      } catch {
        return send(res, 404, { error: "no such flag" });
      }
      const png = readFileSync(file);
      res.writeHead(200, { "content-type": "image/png", "content-length": png.length, "cache-control": "public, max-age=31536000", "access-control-allow-origin": "*" });
      return res.end(png);
    }
    // `icon/` is the same competition's mark on its own; the alternative is
    // spelled out rather than a free path, so nothing can walk out of assets/.
    const asset = path.match(/^\/v1\/assets\/leagues\/(icon\/)?([a-z0-9-]+)\.png$/);
    if (asset) {
      const file = join(ASSETS, "leagues", asset[1] ? "icon" : "", `${asset[2]}.png`);
      try {
        statSync(file);
      } catch {
        return send(res, 404, { error: "no such badge" });
      }
      const png = readFileSync(file);
      // With a length the client knows what it is waiting for; chunked leaves
      // it guessing, and a television that gives up shows a monogram for ever.
      res.writeHead(200, { "content-type": "image/png", "content-length": png.length, "cache-control": "public, max-age=86400", "access-control-allow-origin": "*" });
      return res.end(png);
    }
    // A television's trace, one file per anonymous device under the cache
    // directory, capped so a chatty build cannot fill the disk. There is no
    // Mac to read a television's console; this is the console.
    if (path === "/v1/diag" && req.method === "POST") {
      // Open to anyone who can reach us, so it is rationed: so many posts a
      // minute across every device, so many devices, one body size.
      const now = Date.now();
      if (now - diagWindow.at > 60e3) diagWindow = { at: now, count: 0 };
      if (++diagWindow.count > POSTS_PER_MIN) return send(res, 429, { error: "too many traces" });
      let raw = "";
      req.on("data", (chunk) => {
        raw += chunk;
        if (raw.length > 64 * 1024) req.destroy();
      });
      req.on("error", () => {});
      req.on("end", () => {
        try {
          let body;
          try {
            body = JSON.parse(raw);
          } catch {
            return send(res, 400, { error: "json body required" });
          }
          const device = String(body?.device ?? "");
          if (!/^[a-z0-9]{4,16}$/.test(device) || !Array.isArray(body.lines)) return send(res, 400, { error: "device and lines required" });
          if (!appendTrace(store.dir, device, body.lines)) return send(res, 429, { error: "no room for another device" });
          send(res, 200, { ok: true });
        } catch (err) {
          log(`diag failed: ${err.message}`);
          if (!res.headersSent) send(res, 500, { error: "trace not kept" });
        }
      });
      return;
    }
    if (path === "/v1/health" || path === "/") {
      // Walks every mirrored file and every photo, so not on every ask.
      const prepared = remember("health", () => prepare({
        ok: true,
        uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        events: store.events.size,
        photos: { cached: Object.keys(store.photos || {}).length, pending: photos ? photos.pending().length : undefined },
        images: images ? images.stats() : undefined,
        quota: Object.fromEntries(Object.entries(store.meta).map(([sport, m]) => {
          const limit = limits[sport] ?? null; // null = no daily cap known (e.g. Jolpica)
          return [sport, {
            day: m.calls?.day, used: m.calls?.used ?? 0, limit,
            remaining: limit == null ? null : Math.max(0, limit - (m.calls?.used ?? 0)),
            lastOk: m.lastOk, lastError: scrub(m.lastError),
          }];
        })),
      }), 3000);
      return send(res, 200, undefined, { "cache-control": "no-store" }, req, prepared);
    }
    send(res, 404, { error: "not found" });
  };

  // Nothing a request can say may take the process down: whatever throws is a 500.
  return createServer((req, res) => {
    try {
      handle(req, res);
    } catch (err) {
      log(`request failed: ${req.method} ${String(req.url).slice(0, 120)}: ${err.message}`);
      if (!res.headersSent) send(res, 500, { error: "internal error" });
      else res.end();
    }
  });
}
