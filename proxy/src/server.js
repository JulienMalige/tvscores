import { createServer } from "node:http";
import { buildScoreboard, localDate } from "./scoreboard.js";

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

export function createApp({ store, config, startedAt = Date.now() }) {
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
      return send(res, 200, buildScoreboard(store.all(), { tz, sportOrder: config.sportOrder, meta: store.meta }));
    }
    if (path === "/v1/fixtures") {
      const date = url.searchParams.get("date");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return send(res, 400, { error: "date=YYYY-MM-DD required" });
      const events = store.all().filter((e) => localDate(e.start, tz) === date);
      return send(res, 200, { date, tz, events });
    }
    if (path === "/v1/health" || path === "/") {
      return send(res, 200, {
        ok: true,
        uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        events: store.events.size,
        quota: Object.fromEntries(Object.entries(store.meta).map(([sport, m]) => [sport, {
          day: m.calls?.day, used: m.calls?.used ?? 0, limit: config.schedule.dailyQuota,
          remaining: Math.max(0, config.schedule.dailyQuota - (m.calls?.used ?? 0)),
          lastOk: m.lastOk, lastError: m.lastError,
        }])),
      }, { "cache-control": "no-store" });
    }
    send(res, 404, { error: "not found" });
  });
}
