import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFileSync, statSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
import { buildScoreboard, localDate, withTablePhotos } from "./scoreboard.js";
import { slug } from "./model.js";

/**
 * Ten seconds, not thirty: a score in stoppage time is worth asking about
 * again, and asking costs a header exchange when nothing changed.
 */
const SHORT_CACHE = "public, max-age=10";

/** Crests and portraits change once in a blue moon; let the TV keep them. */
const IMAGE_CACHE = "public, max-age=2592000, immutable";

/**
 * JSON with an ETag, and a bodyless 304 when the caller already has it.
 *
 * The scoreboard is ~50 KB and a television asks for it every minute while a
 * game is on, but it only actually changes when a poll brings something new.
 * The tag is the body's own hash, so "changed" means changed.
 */
function send(res, status, body, extra = {}, req) {
  const json = JSON.stringify(body);
  const etag = `"${createHash("sha1").update(json).digest("base64url")}"`;
  if (status === 200 && req?.headers["if-none-match"] === etag) {
    res.writeHead(304, { etag, "cache-control": SHORT_CACHE, "access-control-allow-origin": "*", ...extra });
    return res.end();
  }
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "public, max-age=30",
    "access-control-allow-origin": "*",
    etag,
    ...extra,
  });
  res.end(json);
}

/** @param limits per-source daily caps ({ football: 100, f1: 200, photos: 1000, ... }), supplied by index.js from the actual quotas. */
export function createApp({ store, config, startedAt = Date.now(), photos, images, activeSports = [], limits = {} }) {
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
  const memo = new Map(); // tz -> { at, body }: the board changes at most every poll, not per request
  const MEMO_MS = 15000;
  return createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    let path = url.pathname;
    if (config.pathPrefix && path.startsWith(config.pathPrefix)) path = path.slice(config.pathPrefix.length) || "/";
    const tz = url.searchParams.get("tz") || "UTC";
    try {
      Intl.DateTimeFormat("en", { timeZone: tz });
    } catch {
      return send(res, 400, { error: `unknown tz ${tz}` });
    }

    if (path === "/v1/scoreboard") {
      const hit = memo.get(tz);
      if (hit && Date.now() - hit.at < MEMO_MS) return send(res, 200, hit.body, {}, req);
      const body = buildScoreboard(store.all(), { tz, sportOrder: config.sportOrder, meta: store.meta, leagues: config.leagues, publicBase: config.publicBase, standings: store.standings, photoFor, mirror, activeSports, upcomingDays: config.schedule.upcomingDays });
      // The tables' crests and portraits are registered with the mirror here
      // too, so the warmer has them before any television opens a table:
      // a crest first mirrored while a page waits for it is the one that
      // arrives late and is remembered as missing.
      if (mirror) for (const table of Object.entries(store.standings)) withTablePhotos(table[1], photoFor, mirror, badgeFor(table[0].split(":")[0]));
      memo.set(tz, { at: Date.now(), body });
      return send(res, 200, body, {}, req);
    }
    if (path === "/v1/fixtures") {
      const date = url.searchParams.get("date");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return send(res, 400, { error: "date=YYYY-MM-DD required" });
      const events = store.all().filter((e) => localDate(e.start, tz) === date);
      return send(res, 200, { date, tz, events }, {}, req);
    }
    if (path === "/v1/standings") {
      return send(res, 200, { standings: Object.fromEntries(Object.entries(store.standings).map(([k, v]) => [k, withTablePhotos(v, photoFor, mirror, badgeFor(k.split(":")[0]))])) });
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
      res.writeHead(200, { "content-type": "image/png", "content-length": badge.length, "cache-control": IMAGE_CACHE, "access-control-allow-origin": "*" });
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
      res.writeHead(200, { "content-type": "image/png", "content-length": png.length, "cache-control": "public, max-age=2592000", "access-control-allow-origin": "*" });
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
    if (path === "/v1/health" || path === "/") {
      return send(res, 200, {
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
            lastOk: m.lastOk, lastError: m.lastError,
          }];
        })),
      }, { "cache-control": "no-store" });
    }
    send(res, 404, { error: "not found" });
  });
}
