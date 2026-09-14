import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
import { buildScoreboard, localDate, withTablePhotos } from "./scoreboard.js";

function send(res, status, body, extra = {}) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "public, max-age=30",
    "access-control-allow-origin": "*",
    ...extra,
  });
  res.end(json);
}

export function createApp({ store, config, startedAt = Date.now(), photos }) {
  const photoFor = photos ? (name) => photos.photoFor(name) : undefined;
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
      return send(res, 200, buildScoreboard(store.all(), { tz, sportOrder: config.sportOrder, meta: store.meta, leagues: config.leagues, publicBase: config.publicBase, standings: store.standings, photoFor }));
    }
    if (path === "/v1/fixtures") {
      const date = url.searchParams.get("date");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return send(res, 400, { error: "date=YYYY-MM-DD required" });
      const events = store.all().filter((e) => localDate(e.start, tz) === date);
      return send(res, 200, { date, tz, events });
    }
    if (path === "/v1/standings") {
      return send(res, 200, { standings: Object.fromEntries(Object.entries(store.standings).map(([k, v]) => [k, withTablePhotos(v, photoFor)])) });
    }
    const one = path.match(/^\/v1\/standings\/([a-z0-9-]+)\/([a-z0-9-]+)$/);
    if (one) {
      const data = store.standings[`${one[1]}:${one[2]}`];
      return data ? send(res, 200, withTablePhotos(data, photoFor)) : send(res, 404, { error: "no standings for this league" });
    }
    const asset = path.match(/^\/v1\/assets\/leagues\/([a-z0-9-]+)\.png$/);
    if (asset) {
      const file = join(ASSETS, "leagues", `${asset[1]}.png`);
      try {
        statSync(file);
      } catch {
        return send(res, 404, { error: "no such badge" });
      }
      res.writeHead(200, { "content-type": "image/png", "cache-control": "public, max-age=86400", "access-control-allow-origin": "*" });
      return res.end(readFileSync(file));
    }
    if (path === "/v1/health" || path === "/") {
      return send(res, 200, {
        ok: true,
        uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        events: store.events.size,
        photos: { cached: Object.keys(store.photos || {}).length, pending: photos ? photos.pending().length : undefined },
        quota: Object.fromEntries(Object.entries(store.meta).map(([sport, m]) => {
          const limit = ["f1", "motogp"].includes(sport) ? config.schedule.ocbDailyQuota : config.schedule.dailyQuota;
          return [sport, {
            day: m.calls?.day, used: m.calls?.used ?? 0, limit,
            remaining: Math.max(0, limit - (m.calls?.used ?? 0)),
            lastOk: m.lastOk, lastError: m.lastError,
          }];
        })),
      }, { "cache-control": "no-store" });
    }
    send(res, 404, { error: "not found" });
  });
}
