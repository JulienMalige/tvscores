import { createServer } from "node:http";
import { MINUTES, blank, sum } from "./audience.js";

/**
 * The page Julien reads the audience on (`Audience`, docs/analytics.md),
 * served on a port of its own that only Tailscale reaches. One HTML page, no
 * script: the last 30 days, and the last 7 broken down. Hours are São Paulo's,
 * which keeps UTC−3 all year; days are UTC days, as they are counted.
 */
const SAO_PAULO = -3;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const BUCKETS = MINUTES.map((bound, i) => (i === 0 ? `under ${bound}` : `${MINUTES[i - 1]}–${bound}`)).concat(`${MINUTES.at(-1)}+`);
const PLATFORMS = { tv: "Apple TV", phone: "iPhone", pad: "iPad", unknown: "Not said (builds before the header)" };

/** A list of bars, longest first: one row per key, its count at the end. */
function bars(title, entries, { label = (k) => k, note = "", limit = 12, detail, sorted = true } = {}) {
  const rows = (sorted ? entries.sort((a, b) => b[1] - a[1]) : entries).slice(0, limit);
  if (!rows.length) return `<section><h2>${esc(title)}</h2><p class="muted">Nothing yet.</p></section>`;
  const max = Math.max(...rows.map((r) => r[1]), 1);
  return `<section><h2>${esc(title)}</h2>${note ? `<p class="muted">${esc(note)}</p>` : ""}<ul class="bars">${rows.map(([key, n]) => `
    <li><span class="label">${esc(label(key))}</span><span class="track"><span class="bar" style="width:${((n / max) * 100).toFixed(1)}%"></span></span><span class="value">${fmt(n)}${detail ? `<small>${esc(detail(key))}</small>` : ""}</span></li>`).join("")}</ul></section>`;
}

/** Vertical bars on one baseline, oldest on the left: each with its value on hover, and a table below says them all. */
function columns(title, points, { note = "", tick = () => "" } = {}) {
  const w = 720, h = 180, top = 16, bottom = 24, gap = 2;
  const max = Math.max(...points.map((p) => p.value), 1);
  const step = w / points.length;
  const width = Math.max(step - gap, 1);
  const base = h - bottom;
  const scale = (v) => ((base - top) * v) / max;
  const path = (x, v) => {
    const y = base - scale(v);
    const r = Math.min(4, width / 2, scale(v));
    return `M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${base} Z`;
  };
  return `<section><h2>${esc(title)}</h2>${note ? `<p class="muted">${esc(note)}</p>` : ""}
  <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">
    <line class="grid" x1="0" x2="${w}" y1="${top}" y2="${top}"/><text class="axis" x="${w}" y="${top - 4}" text-anchor="end">${fmt(max)}</text>
    <line class="baseline" x1="0" x2="${w}" y1="${base}" y2="${base}"/>
    ${points.map((p, i) => `<g>${p.value ? `<path class="mark" d="${path(i * step + gap / 2, p.value)}"/>` : ""}<rect x="${i * step}" y="0" width="${step}" height="${h}" fill="transparent"><title>${esc(p.label)}: ${fmt(p.value)}</title></rect>${tick(i) ? `<text class="axis" x="${i * step + step / 2}" y="${h - 6}" text-anchor="middle">${esc(tick(i))}</text>` : ""}</g>`).join("")}
  </svg></section>`;
}

/** A number with what it counts, for today and the day before. */
const tile = (label, today, before) => `<div class="tile"><span class="muted">${esc(label)}</span><strong>${fmt(today)}</strong><span class="muted">yesterday ${fmt(before)}</span></div>`;

export function renderAudience(days, { nameOf = (key) => key } = {}) {
  const today = days[0] ?? blank("today");
  const yesterday = days[1] ?? blank("yesterday");
  const week = days.slice(0, 7).reduce((acc, d) => sum(acc, d), blank("week"));
  const month = [...days].reverse();
  const hours = Array.from({ length: 24 }, (_, local) => week.hours[(local - SAO_PAULO + 24) % 24]);
  const restarts = days.slice(0, 7).reduce((n, d) => n + (d.restarts ?? 0), 0);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>TV Scores audience</title>
<style>
:root { --surface:#fcfcfb; --page:#f9f9f7; --ink:#0b0b0b; --ink2:#52514e; --muted:#898781; --grid:#e1e0d9; --axis:#c3c2b7; --mark:#2a78d6; color-scheme: light dark; }
@media (prefers-color-scheme: dark) { :root { --surface:#1a1a19; --page:#0d0d0d; --ink:#f0efec; --ink2:#c3c2b7; --grid:#2c2c2a; --axis:#383835; --mark:#3987e5; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--page); color: var(--ink); font: 15px/1.45 -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif; }
main { max-width: 920px; margin: 0 auto; padding: 20px 16px 48px; }
h1 { font-size: 26px; margin: 0 0 4px; } h2 { font-size: 17px; margin: 0 0 8px; }
.muted { color: var(--muted); font-size: 13px; margin: 0 0 8px; }
section, .tiles { background: var(--surface); border-radius: 14px; padding: 16px; margin: 14px 0; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
.tile { display: flex; flex-direction: column; } .tile strong { font-size: 30px; font-variant-numeric: tabular-nums; }
.grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 0 14px; } .grid2 section { margin: 14px 0 0; }
svg { width: 100%; height: auto; display: block; } .mark { fill: var(--mark); } .grid { stroke: var(--grid); stroke-width: 1; } .baseline { stroke: var(--axis); stroke-width: 1; }
.axis { fill: var(--muted); font-size: 11px; }
.bars { list-style: none; margin: 0; padding: 0; } .bars li { display: grid; grid-template-columns: minmax(90px, 38%) 1fr auto; align-items: center; gap: 10px; padding: 3px 0; }
.label { color: var(--ink2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .track { height: 12px; }
.bar { display: block; height: 12px; background: var(--mark); border-radius: 0 4px 4px 0; min-width: 2px; }
.value { font-variant-numeric: tabular-nums; text-align: right; } .value small { color: var(--muted); margin-left: 6px; }
table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; } th, td { text-align: right; padding: 4px 6px; border-bottom: 1px solid var(--grid); } th:first-child, td:first-child { text-align: left; } th { color: var(--muted); font-weight: 500; }
</style></head><body><main>
<h1>TV Scores audience</h1>
<p class="muted">Counted on the server from the requests of every copy of the app, 1.0 included, whether or not its viewer shares usage with Amplitude. Totals only; days are UTC days. A device is one address, one app build and one language within a day.</p>
<div class="tiles">
  ${tile("Devices today", today.devices, yesterday.devices)}
  ${tile("Sittings", today.sittings, yesterday.sittings)}
  ${tile("Minutes with the app open", today.minutes.total, yesterday.minutes.total)}
  ${tile("Boards served", today.boards, yesterday.boards)}
</div>
${columns("Devices a day, last 30 days", month.map((d) => ({ label: d.day, value: d.devices })), { tick: (i) => (i === 0 || i === month.length - 1 ? month[i].day.slice(5) : "") })}
${columns("When, São Paulo time, last 7 days", hours.map((value, local) => ({ label: `${String(local).padStart(2, "0")}:00`, value })), { note: "Devices with the app open in each hour, added up over the 7 days.", tick: (i) => (i % 3 === 0 ? `${i}h` : "") })}
<div class="grid2">
${bars("Kind of device", Object.entries(week.platforms), { label: (k) => PLATFORMS[k] ?? k, note: "Device-days over the last 7 days: a device that came on 3 days counts 3." })}
${bars("Countries", Object.entries(week.countries), { label: (k) => (k === "unknown" ? "Unknown" : new Intl.DisplayNames(["en"], { type: "region" }).of(k) ?? k) })}
${bars("Time zones", Object.entries(week.timeZones))}
${bars("Languages", Object.entries(week.languages))}
${bars("App builds", Object.entries(week.builds), { label: (k) => `build ${k}` })}
${bars("Minutes with the app open, per device and day", BUCKETS.map((label, i) => [label, week.minutes.buckets[i]]).filter(([, n]) => n), { limit: BUCKETS.length, sorted: false })}
${bars("Tables opened", Object.entries(week.tables).map(([k, v]) => [k, v.devices]), { label: nameOf, detail: (k) => `${fmt(week.tables[k].opens)} opens`, note: "Devices that opened each competition's table; the opens beside them." })}
${bars("Game pages opened", Object.entries(week.games).map(([k, v]) => [k, v.devices]), { detail: (k) => `${fmt(week.games[k].opens)} opens`, note: "Football, NFL and NBA: the sports whose games have a page from the server." })}
</div>
<section><h2>Day by day</h2>${restarts ? `<p class="muted">The server restarted ${restarts} time${restarts > 1 ? "s" : ""} this week: a device seen on both sides of a restart counts twice that day.</p>` : ""}
<table><thead><tr><th>Day</th><th>Devices</th><th>Sittings</th><th>Minutes</th><th>Boards</th></tr></thead><tbody>
${days.map((d) => `<tr><td>${esc(d.day)}${d.restarts ? " *" : ""}</td><td>${fmt(d.devices)}</td><td>${fmt(d.sittings)}</td><td>${fmt(d.minutes.total)}</td><td>${fmt(d.boards)}</td></tr>`).join("")}
</tbody></table></section>
</main></body></html>`;
}

/** The page's own server, GET / and nothing else, for a port only Tailscale's serve reaches (~/VPS.md). */
export function createAudienceServer(audience, options) {
  return createServer((req, res) => {
    try {
      if (req.method !== "GET" || String(req.url).split("?")[0] !== "/") {
        res.writeHead(404, { "content-type": "text/plain" });
        return res.end("not found");
      }
      const body = renderAudience(audience.days(30), options);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(body);
    } catch {
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
      res.end("the page failed");
    }
  });
}
