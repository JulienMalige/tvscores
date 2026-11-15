import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Audience, SITTING_GAP } from "../src/audience.js";
import { renderAudience } from "../src/audience-page.js";

const noon = Date.UTC(2026, 10, 15, 12, 0, 0);
const APP = "TV%20Scores/51 CFNetwork/3826.500.111 Darwin/25.1.0";
const dir = () => mkdtempSync(join(tmpdir(), "tvscores-audience-"));

/** A request of the app's, through Cloudflare, from `ip`. */
const ask = (ip, { agent = APP, language = "fr-FR,fr;q=0.9", country = "FR", platform } = {}) => ({
  headers: { "cf-connecting-ip": ip, "user-agent": agent, "accept-language": language, "cf-ipcountry": country, ...(platform ? { "x-tvscores-platform": platform } : {}) },
});
const board = (a, req) => a.note(req, "/v1/scoreboard", new URL("http://x/v1/scoreboard?tz=Europe/Paris"), "Europe/Paris");

test("counts the app through Cloudflare, not this machine, a browser or CI's builds", () => {
  const a = new Audience({ dir: dir(), now: () => noon });
  board(a, { headers: { "user-agent": APP } });
  board(a, ask("203.0.113.9", { agent: "Mozilla/5.0 (iPad)" }));
  board(a, ask("203.0.113.9", { agent: "TV%20Scores/1 CFNetwork/3826 Darwin/25.1.0" }));
  board(a, ask("203.0.113.9", { agent: "curl/8.5.0" }));
  assert.equal(a.totals().devices, 0);
  board(a, ask("203.0.113.9"));
  board(a, ask("198.51.100.4", { agent: "TVScores/46 CFNetwork/1568.300.101 Darwin/24.0.0" }));
  assert.equal(a.totals().devices, 2, "the app, however the system spells its name");
  assert.deepEqual(a.totals().builds, { 51: 1, 46: 1 });
});

test("a device is an address, an agent and a language within the day", () => {
  const a = new Audience({ dir: dir(), now: () => noon });
  board(a, ask("203.0.113.9"));
  board(a, ask("203.0.113.9"));
  board(a, ask("203.0.113.9", { language: "pt-BR" }));
  board(a, ask("198.51.100.4", { country: "BR", platform: "tv" }));
  const t = a.totals();
  assert.equal(t.devices, 3);
  assert.equal(t.boards, 4);
  assert.deepEqual(t.countries, { FR: 2, BR: 1 });
  assert.deepEqual(t.languages, { "fr-FR": 2, "pt-BR": 1 });
  assert.deepEqual(t.platforms, { unknown: 2, tv: 1 });
  assert.deepEqual(t.timeZones, { "Europe/Paris": 3 });
});

test("polls a few minutes apart are one sitting, and its minutes; a long pause starts another", () => {
  let now = noon;
  const a = new Audience({ dir: dir(), now: () => now });
  for (const minutes of [0, 3, 6]) {
    now = noon + minutes * 60e3;
    board(a, ask("203.0.113.9"));
  }
  now = noon + 6 * 60e3 + SITTING_GAP + 1;
  board(a, ask("203.0.113.9"));
  const t = a.totals();
  assert.equal(t.sittings, 2);
  assert.equal(t.minutes.total, 6);
  assert.equal(t.minutes.buckets[2], 1, "5 to 15 minutes");
  assert.equal(t.hours[12], 1);
});

test("tables and game pages: how many devices opened each, and how often", () => {
  const a = new Audience({ dir: dir(), now: () => noon });
  const table = (ip) => a.note(ask(ip), "/v1/standings/rugby/4430", new URL("http://x/v1/standings/rugby/4430"), "UTC");
  table("203.0.113.9");
  table("203.0.113.9");
  table("198.51.100.4");
  a.note(ask("203.0.113.9"), "/v1/event", new URL("http://x/v1/event?id=football:tsdb:123"), "UTC");
  a.note(ask("203.0.113.9"), "/v1/img/abc", new URL("http://x/v1/img/abc"), "UTC");
  const t = a.totals();
  assert.deepEqual(t.tables, { "rugby:4430": { opens: 3, devices: 2 } });
  assert.deepEqual(t.games, { football: { opens: 1, devices: 1 } });
});

test("nothing that could name a device reaches the disk, only totals", () => {
  const where = dir();
  const a = new Audience({ dir: where, now: () => noon });
  board(a, ask("203.0.113.9"));
  a.save();
  const text = readFileSync(join(where, "2026-11-15.json"), "utf8");
  assert.ok(!text.includes("203.0.113"), "no address");
  assert.ok(!text.includes("CFNetwork"), "no user agent");
  assert.equal(JSON.parse(text).devices, 1);
});

test("a new day closes the last with its totals, with a new key and an empty table", () => {
  let now = noon;
  let keys = 0;
  const where = dir();
  const a = new Audience({ dir: where, now: () => now, newKey: () => Buffer.from(`key ${++keys}`) });
  board(a, ask("203.0.113.9"));
  now = noon + 24 * 3600e3;
  board(a, ask("198.51.100.4"));
  assert.equal(keys, 2);
  assert.equal(JSON.parse(readFileSync(join(where, "2026-11-15.json"), "utf8")).devices, 1, "yesterday final");
  assert.equal(a.totals().devices, 1, "today's own");
  assert.equal(a.totals().day, "2026-11-16");
});

test("a restart carries the day's totals and says so", () => {
  const where = dir();
  const before = new Audience({ dir: where, now: () => noon });
  board(before, ask("203.0.113.9"));
  before.save();
  const after = new Audience({ dir: where, now: () => noon + 60e3 });
  board(after, ask("203.0.113.9"));
  const t = after.totals();
  assert.equal(t.restarts, 1);
  assert.equal(t.devices, 2, "the same device on both sides counts twice");
  assert.equal(t.day, "2026-11-15");
});

test("the last days, newest first, today's as it stands", () => {
  const where = dir();
  writeFileSync(join(where, "2026-11-13.json"), JSON.stringify({ day: "2026-11-13", devices: 5 }));
  writeFileSync(join(where, "2026-11-14.json"), JSON.stringify({ day: "2026-11-14", devices: 7 }));
  const a = new Audience({ dir: where, now: () => noon });
  board(a, ask("203.0.113.9"));
  assert.deepEqual(a.days(30).map((d) => [d.day, d.devices]), [["2026-11-15", 1], ["2026-11-14", 7], ["2026-11-13", 5]]);
  assert.deepEqual(readdirSync(where).sort(), ["2026-11-13.json", "2026-11-14.json"], "today reaches the disk when saved");
});

test("the page names the competitions, says the hours in São Paulo time, and escapes what it shows", () => {
  const a = new Audience({ dir: dir(), now: () => noon });
  board(a, ask("203.0.113.9"));
  a.note(ask("203.0.113.9"), "/v1/standings/rugby/4430", new URL("http://x/v1/standings/rugby/4430"), "UTC");
  const html = renderAudience(a.days(30), { nameOf: (key) => (key === "rugby:4430" ? "Top 14 <&>" : key) });
  assert.match(html, /TV Scores audience/);
  assert.match(html, /Top 14 &lt;&amp;&gt;/);
  assert.match(html, /09:00: 1/, "noon UTC is 9 in São Paulo");
  assert.doesNotMatch(html, /<script/);
});

test("Amplitude's count of the viewers who said yes sits beside the server's, in totals", async () => {
  const { amplitudeReader } = await import("../src/amplitude.js");
  const asked = [];
  const fetch = async (url, { headers }) => {
    asked.push({ url, auth: headers.authorization });
    const data = url.includes("sessions/average") ? { xValues: ["2026-11-14T00:00:00", "2026-11-15T00:00:00"], series: [[42.9, 36.4]] }
      : url.includes("g=country") ? { xValues: ["2026-11-14", "2026-11-15"], series: [[1, 2], [0, 1]], seriesLabels: ["Brazil", "France"] }
      : url.includes("store") ? { xValues: ["2026-11-14", "2026-11-15"], series: [[0, 0]], seriesLabels: [0] }
      : { xValues: ["2026-11-14", "2026-11-15"], series: [[1, 2]], seriesLabels: [0] };
    return { ok: true, json: async () => ({ data }) };
  };
  const summary = amplitudeReader({ key: "k", secret: "s", fetch, now: () => noon });
  const said = await summary();
  assert.deepEqual(said.days, { "2026-11-14": 1, "2026-11-15": 2 });
  assert.deepEqual(said.countries, { Brazil: 3, France: 1 });
  assert.deepEqual(said.tester, { "2026-11-14": 1, "2026-11-15": 2 });
  assert.deepEqual(said.store, { "2026-11-14": 0, "2026-11-15": 0 });
  assert.deepEqual(said.sessionSeconds, { "2026-11-14": 42.9, "2026-11-15": 36.4 });
  await summary();
  assert.equal(asked.length, 6, "kept ten minutes: opening the page twice asks once");
  assert.equal(asked[0].auth, `Basic ${Buffer.from("k:s").toString("base64")}`);
  const a = new Audience({ dir: dir(), now: () => noon });
  // Three devices on the server, two of them on the same build.
  board(a, ask("203.0.113.9", { agent: "TV%20Scores/50 CFNetwork/1 Darwin/25.1.0" }));
  board(a, ask("198.51.100.4", { agent: "TV%20Scores/50 CFNetwork/1 Darwin/25.1.0" }));
  board(a, ask("192.0.2.1", { agent: "TV%20Scores/51 CFNetwork/1 Darwin/25.1.0" }));
  const html = renderAudience(a.days(30), { amplitude: { ...said, tester: { "2026-11-15": 2 } } });
  assert.match(html, /How many use it\?<\/span><strong>3</);
  assert.match(html, /How many different people this month\?<\/span><strong>2</, "Amplitude's month");
  assert.match(html, /of today&#39;s said yes \(Amplitude\)/);
  assert.match(html, /Countries, Amplitude/);
});

test("an iPhone and an iPad behind one address, on the same build and system, are two devices once they say their kind", () => {
  const a = new Audience({ dir: dir(), now: () => noon });
  board(a, ask("203.0.113.9", { platform: "phone" }));
  board(a, ask("203.0.113.9", { platform: "pad" }));
  board(a, ask("203.0.113.9", { platform: "phone" }));
  assert.equal(a.totals().devices, 2);
  assert.deepEqual(a.totals().platforms, { phone: 1, pad: 1 });
});

test("Apple's downloads: first ones apart from re-downloads, by device and country", async () => {
  const { parseDownloads } = await import("../src/apple-reports.js");
  const rows = parseDownloads("Date\tApp Name\tDownload Type\tDevice\tTerritory\tCounts\n2026-11-13\tTV Scores\tFirst-time download\tApple TV\tUS\t2\n2026-11-14\tTV Scores\tRestore\tApple TV\tFR\t1\n");
  assert.deepEqual(rows, [
    { date: "2026-11-13", type: "First-time download", device: "Apple TV", territory: "US", count: 2 },
    { date: "2026-11-14", type: "Restore", device: "Apple TV", territory: "FR", count: 1 },
  ]);
  const a = new Audience({ dir: dir(), now: () => noon });
  const html = renderAudience(a.days(30), { apple: rows });
  assert.match(html, /How many installed it\?<\/span><strong>2</);
  assert.match(html, /1 re-downloads/);
  assert.match(html, /installs: Apple TV 100%/);
});
