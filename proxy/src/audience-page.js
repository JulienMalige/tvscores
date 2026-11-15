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
const SPORTS = { football: "Football", nfl: "NFL", nba: "NBA" };
/** A UTC day as a person says it: "Sat 15 Nov". */
const dayName = (day) => (day ? new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) : "");
const PLATFORMS = { tv: "Apple TV", phone: "iPhone", pad: "iPad", unknown: "Not said" };
const opens = (n) => `${fmt(n)} open${n === 1 ? "" : "s"}`;

/** A list of bars, longest first: one row per key, its count at the end. */
function bars(title, entries, { label = (k) => k, note = "", limit = 12, detail, sorted = true } = {}) {
  const rows = (sorted ? entries.sort((a, b) => b[1] - a[1]) : entries).slice(0, limit);
  if (!rows.length) return `<section><h2>${esc(title)}</h2><p class="muted">Nothing yet.</p></section>`;
  const max = Math.max(...rows.map((r) => r[1]), 1);
  return `<section><h2>${esc(title)}</h2>${note ? `<p class="muted">${esc(note)}</p>` : ""}<ul class="bars">${rows.map(([key, n]) => `
    <li><span class="label">${esc(label(key))}</span><span class="track"><span class="bar" style="width:${((n / max) * 100).toFixed(1)}%"></span></span><span class="value">${fmt(n)}${detail ? `<small>${esc(detail(key))}</small>` : ""}</span></li>`).join("")}</ul></section>`;
}

/**
 * Vertical bars on one baseline, oldest on the left, drawn in HTML so their
 * words keep their size on a phone: the tallest bar's value above, each bar's
 * own on hover, and the table below says them all.
 */
function columns(title, points, { note = "", ticks = [] } = {}) {
  const max = Math.max(...points.map((p) => p.value), 1);
  return `<section><h2>${esc(title)}</h2>${note ? `<p class="muted">${esc(note)}</p>` : ""}
  <p class="max">${fmt(max)}</p>
  <div class="cols" role="img" aria-label="${esc(title)}">${points.map((p) => `<span class="col" title="${esc(p.label)}: ${fmt(p.value)}"><span class="colbar" style="height:${((p.value / max) * 100).toFixed(1)}%"></span></span>`).join("")}</div>
  <div class="ticks">${ticks.map((t) => `<span>${esc(t)}</span>`).join("")}</div></section>`;
}


/**
 * The builds on the App Store; the others are test copies, Julien's own among
 * them. Add a build here when a version ships (docs/analytics.md).
 */
const STORE_BUILDS = ["46"];
const storeDevices = (d) => STORE_BUILDS.reduce((n, b) => n + (d.builds?.[b] ?? 0), 0);
const pct = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : "–");
const regionName = (k) => (k === "unknown" ? "Unknown" : new Intl.DisplayNames(["en"], { type: "region" }).of(k) ?? k);
const top = (counts, label, n = 3) => {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return Object.entries(counts).sort((x, y) => y[1] - x[1]).slice(0, n).map(([k, v]) => `${label(k)} ${pct(v, total)}`).join(" · ") || "–";
};

/** One question, its answer, and where the answer comes from. */
const answer = (question, value, what, source) => `<div class="answer"><span class="q">${esc(question)}</span><strong>${value}</strong><span>${esc(what)}</span><small>${esc(source)}</small></div>`;

/**
 * The six questions Julien asks of the audience (2026-11-15), each answered by
 * the source that knows it best: Apple for installs, the server for use by
 * everyone, Amplitude for the exact count of the viewers who said yes.
 */
function answers(days, amplitude, apple = []) {
  const today = days[0];
  const since = (n) => new Date(Date.parse(`${today.day}T00:00:00Z`) - (n - 1) * 864e5).toISOString().slice(0, 10);
  // The last 7 calendar days, not the last 7 days that had a file.
  const week = days.filter((d) => d.day >= since(7)).reduce((acc, d) => sum(acc, d), blank("week"));
  const first = apple.filter((r) => r.type === "First-time download");
  const count = (rows, from) => rows.filter((r) => r.date >= from).reduce((n, r) => n + r.count, 0);
  // Re-downloads and restores, not the updates the same report counts.
  const again = apple.filter((r) => r.type === "Redownload" || r.type === "Restore");
  const byKey = (rows, key) => rows.reduce((acc, r) => ({ ...acc, [r[key]]: (acc[r[key]] ?? 0) + r.count }), {});
  const deviceDays = week.devices;
  // The days counted so far, up to 7: the server began on 2026-11-15.
  const counted = Math.max(1, days.filter((d) => d.day >= since(7)).length);
  const engaged = week.minutes.buckets.slice(3).reduce((a, b) => a + b, 0);
  const seconds = Object.entries(amplitude?.sessionSeconds ?? {}).filter(([day, v]) => day >= since(7) && v > 0).map(([, v]) => v);
  const session = seconds.length ? `${(seconds.reduce((a, b) => a + b, 0) / seconds.length / 60).toFixed(1)} min` : "–";
  const kinds = Object.fromEntries(Object.entries(week.platforms).filter(([k]) => k !== "unknown"));
  return `<div class="answers">
  ${answer("How many installed it?", fmt(count(first, since(30))), "first downloads, last 30 days", `Apple, a day or two behind · ${fmt(count(first, since(7)))} in the last 7 days · ${fmt(count(again, since(30)))} re-downloads`)}
  ${answer("How many use it?", fmt(today.devices), "devices today", `Server, every version · ${fmt(deviceDays / counted)} a day over the last ${counted} day${counted > 1 ? "s" : ""}${amplitude ? ` · ${fmt(amplitude.days?.[today.day] ?? 0)} of today's said yes (Amplitude)` : ""}`)}
  ${answer("How many different people this month?", amplitude ? fmt(amplitude.thisMonth ?? 0) : "–", "since the 1st, counted once each", "Amplitude, exact, only those who said yes; the server cannot tell days apart")}
  ${answer("How many really use it?", pct(engaged, deviceDays), "of the days a device came, it stayed 15 minutes or more", `Server, everyone, last 7 days · a session lasts ${session} (Amplitude)`)}
  ${answer("From where?", "", top(week.countries, regionName), `Server, last 7 days · installs: ${top(byKey(first, "territory"), regionName)} (Apple)`)}
  ${answer("On which device?", "", `installs: ${top(byKey(first, "device"), (k) => k)}`, `Apple, last 30 days · in use: ${Object.keys(kinds).length ? top(kinds, (k) => PLATFORMS[k] ?? k) : "from the next build"} (server)`)}
</div>`;
}

/** `amplitude`: its count of the viewers who said yes, by day and by country (`amplitude.js`), or nothing. */
export function renderAudience(days, { nameOf = (key) => key, amplitude, apple } = {}) {
  const said = (day) => amplitude?.days?.[day] ?? 0;
  const today = days[0] ?? blank("today");
  const yesterday = days[1] ?? blank("yesterday");
  const week = days.slice(0, 7).reduce((acc, d) => sum(acc, d), blank("week"));
  // Thirty slots, the days with nothing in them too, today's on the right.
  const byDay = new Map(days.map((d) => [d.day, d]));
  const month = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(Date.parse(`${today.day}T00:00:00Z`) - (29 - i) * 864e5).toISOString().slice(0, 10);
    return byDay.get(day) ?? blank(day);
  });
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
.max { color: var(--muted); font-size: 12px; text-align: right; margin: 0; border-bottom: 1px solid var(--grid); }
.cols { display: flex; align-items: flex-end; gap: 2px; height: 150px; border-bottom: 1px solid var(--axis); }
.col { flex: 1; height: 100%; display: flex; align-items: flex-end; } .colbar { width: 100%; background: var(--mark); border-radius: 4px 4px 0 0; }
.ticks { display: flex; justify-content: space-between; color: var(--muted); font-size: 12px; margin-top: 4px; }
.bars { list-style: none; margin: 0; padding: 0; } .bars li { display: grid; grid-template-columns: minmax(90px, 38%) 1fr auto; align-items: center; gap: 10px; padding: 3px 0; }
.label { color: var(--ink2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .track { height: 12px; }
.bar { display: block; height: 12px; background: var(--mark); border-radius: 0 4px 4px 0; min-width: 2px; }
.answers { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; margin: 14px 0; }
.answer { background: var(--surface); border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 2px; }
.answer .q { font-weight: 600; } .answer strong { font-size: 34px; font-variant-numeric: tabular-nums; } .answer small { color: var(--muted); font-size: 12px; margin-top: 6px; }
details > summary { cursor: pointer; font-size: 17px; font-weight: 600; margin: 24px 0 4px; }
.value { font-variant-numeric: tabular-nums; text-align: right; } .value small { color: var(--muted); margin-left: 6px; }
table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; } th, td { text-align: right; padding: 4px 6px; border-bottom: 1px solid var(--grid); white-space: nowrap; } th:first-child, td:first-child { text-align: left; } th { color: var(--muted); font-weight: 500; }
</style></head><body><main>
<h1>TV Scores audience</h1>
<p class="muted">Six answers, each from the source that knows it best. The details are underneath.</p>
${answers(days, amplitude, apple)}
<details><summary>Details</summary>
<p class="muted">The server counts every copy of the app, 1.0 included, in totals; days are UTC days. Within a day it tells devices apart by address, app build, system version, language and kind, so a VPN or a new address counts a device twice.</p>
${columns("Devices a day, last 30 days", month.map((d) => ({ label: dayName(d.day), value: d.devices })), { ticks: [dayName(month[0]?.day), dayName(month.at(-1)?.day)] })}
${columns("When, São Paulo time, last 7 days", hours.map((value, local) => ({ label: `${String(local).padStart(2, "0")}:00`, value })), { note: "Devices with the app open in each hour, added up over the 7 days.", ticks: ["0h", "6h", "12h", "18h", "23h"] })}
<div class="grid2">
${bars("Kind of device", Object.entries(week.platforms), { label: (k) => PLATFORMS[k] ?? k, note: "Device-days over the last 7 days: a device that came on 3 days counts 3. Builds up to 51 do not say their kind." })}
${amplitude ? bars("Countries, Amplitude", Object.entries(amplitude.countries), { note: "Users who said yes over the last 7 days, once per country, from each device's own address. A device on a VPN shows in the VPN's country too." }) : ""}
${bars("Countries", Object.entries(week.countries), { label: regionName })}
${bars("Time zones", Object.entries(week.timeZones))}
${bars("Languages", Object.entries(week.languages))}
${bars("App builds", Object.entries(week.builds), { label: (k) => `build ${k}` })}
${bars("Minutes with the app open, per device and day", BUCKETS.map((label, i) => [label, week.minutes.buckets[i]]).filter(([, n]) => n), { limit: BUCKETS.length, sorted: false })}
${bars("Tables opened", Object.entries(week.tables).map(([k, v]) => [k, v.devices]), { label: nameOf, detail: (k) => opens(week.tables[k].opens), note: "Devices that opened each competition's table; the opens beside them." })}
${bars("Game pages opened", Object.entries(week.games).map(([k, v]) => [k, v.devices]), { label: (k) => SPORTS[k] ?? k, detail: (k) => opens(week.games[k].opens), note: "Football, NFL and NBA: the sports whose games have a page from the server." })}
</div>
<section><h2>Day by day</h2>${restarts ? `<p class="muted">The server restarted ${restarts} time${restarts > 1 ? "s" : ""} this week: a device seen on both sides of a restart counts twice that day.</p>` : ""}
<table><thead><tr><th>Day</th><th>Devices</th><th>Sittings</th><th>Minutes</th><th>Boards</th><th>Store build</th>${amplitude ? "<th>Said yes</th>" : ""}</tr></thead><tbody>
${days.map((d) => `<tr><td>${esc(dayName(d.day))}${d.restarts ? " *" : ""}</td><td>${fmt(d.devices)}</td><td>${fmt(d.sittings)}</td><td>${fmt(d.minutes.total)}</td><td>${fmt(d.boards)}</td><td>${fmt(storeDevices(d))}</td>${amplitude ? `<td>${fmt(said(d.day))}</td>` : ""}</tr>`).join("")}
</tbody></table></section>
</details>
</main></body></html>`;
}

/** The page's own server, GET / and nothing else, for a port only Tailscale's serve reaches (~/VPS.md). */
export function createAudienceServer(audience, { amplitude, apple, ...options } = {}) {
  return createServer(async (req, res) => {
    try {
      if (req.method !== "GET" || String(req.url).split("?")[0] !== "/") {
        res.writeHead(404, { "content-type": "text/plain" });
        return res.end("not found");
      }
      // Amplitude's side when it answers; the server's alone when it does not.
      const [said, downloads] = await Promise.all([amplitude?.().catch(() => undefined), apple?.().catch(() => [])]);
      const body = renderAudience(audience.days(30), { ...options, amplitude: said, apple: downloads });
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(body);
    } catch {
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
      res.end("the page failed");
    }
  });
}
