import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/cache.js";
import { createApp } from "../src/server.js";
import { config } from "../src/config.js";
import { serve, raw } from "./helpers/serve.js";

test("nothing a request can say takes the process down", async () => {
  const s = await serve();
  try {
    const body = (b) => fetch(`http://127.0.0.1:${s.port}/tvscores/v1/diag`, { method: "POST", body: b });
    assert.equal((await body("null")).status, 400, "a null body");
    assert.equal((await body("[]")).status, 400, "an array");
    assert.equal((await body('"x"')).status, 400, "a string");
    assert.equal((await body("{")).status, 400, "not JSON");
    assert.match(await raw(s.port, "GET http:// HTTP/1.1\r\nHost: x\r\n\r\n"), /HTTP\/1\.1 (400|500)/, "an address that is not one");
    assert.equal((await s.get("/v1/health")).status, 200, "and the proxy is still up");
  } finally {
    await s.close();
  }
});

test("a timezone is one canonical name or it is refused", async () => {
  const s = await serve();
  try {
    assert.equal((await s.get("/v1/scoreboard?tz=america/sao_paulo")).status, 200);
    assert.equal((await s.get("/v1/scoreboard?tz=%2B05:31")).status, 400, "an offset is not a zone");
    assert.equal((await s.get("/v1/scoreboard?tz=" + "A".repeat(500))).status, 400);
    const a = await s.get("/v1/scoreboard?tz=america/sao_paulo");
    const b = await s.get("/v1/scoreboard?tz=America/Sao_Paulo");
    assert.equal(a.headers.get("etag"), b.headers.get("etag"), "the spellings are one board");
  } finally {
    await s.close();
  }
});

test("the board is gzipped for a client that takes it, and one bad event does not stop it", async () => {
  const s = await serve();
  try {
    const game = (i, start) => ({ id: `football:tsdb:${i}`, sport: "football", kind: "match", league: { id: 4328, name: "Premier League", short: "PL" }, start, status: { state: "scheduled" }, home: { name: `Home ${i}`, short: "HOM" }, away: { name: `Away ${i}`, short: "AWY" }, score: { home: null, away: null } });
    const today = new Date().toISOString();
    s.store.upsert(Array.from({ length: 40 }, (_, i) => game(i, today)));
    s.store.events.set("football:tsdb:bad", game("bad", "not a date")); // one that got past the store's own guard
    const url = `http://127.0.0.1:${s.port}/tvscores/v1/scoreboard?tz=UTC`;
    const plain = await fetch(url, { headers: { "accept-encoding": "identity" } });
    assert.equal(plain.status, 200, "the unreadable date is left off, not fatal");
    assert.equal(plain.headers.get("content-encoding"), null);
    const size = (await plain.text()).length;
    assert.ok(size > 1024, `a board big enough to be worth compressing (${size} bytes)`);
    const zipped = await fetch(url, { headers: { "accept-encoding": "gzip" } });
    assert.equal(zipped.headers.get("content-encoding"), "gzip");
    assert.match(zipped.headers.get("vary"), /accept-encoding/i);
    assert.equal((await zipped.json()).days.today.length > 0, true, "and it is the same board");
    const refused = await fetch(url, { headers: { "accept-encoding": "gzip;q=0" } });
    assert.equal(refused.headers.get("content-encoding"), null, "gzip at q=0 is a refusal");
    const fixtures = await fetch(`http://127.0.0.1:${s.port}/tvscores/v1/fixtures?date=${today.slice(0, 10)}&tz=UTC`);
    assert.equal(fixtures.status, 200, "and the fixtures are not taken down by it either");
  } finally {
    await s.close();
  }
});

test("a 304 stands for a few minutes at most, so a television's clock cannot go stale", async () => {
  const s = await serve();
  const realNow = Date.now;
  const bucket = 5 * 60e3;
  const start = Math.floor(realNow() / bucket) * bucket + 60e3; // a minute into a window, whatever the wall clock says
  try {
    Date.now = () => start;
    const first = await s.get("/v1/scoreboard?tz=UTC");
    const tag = first.headers.get("etag");
    Date.now = () => start + 30e3;
    assert.equal((await s.get("/v1/scoreboard?tz=UTC", { "if-none-match": tag })).status, 304);
    assert.equal((await s.get("/v1/scoreboard?tz=UTC", { "if-none-match": `W/${tag}, "other"` })).status, 304, "weakened, or one of a list, it is still ours");
    Date.now = () => start + 6 * 60e3; // past the window, and past the memo
    assert.equal((await s.get("/v1/scoreboard?tz=UTC", { "if-none-match": tag })).status, 200, "after five minutes the body is sent again");
  } finally {
    Date.now = realNow;
    await s.close();
  }
});

test("the diag endpoint is rationed and cannot be made to forge lines", async () => {
  const dir = mkdtempSync(join(tmpdir(), "tvscores-diag-"));
  const store = new Store(dir);
  const app = createApp({ store, config });
  await new Promise((done) => app.listen(0, "127.0.0.1", done));
  const { port } = app.address();
  const post = (device, lines) => fetch(`http://127.0.0.1:${port}/tvscores/v1/diag`, { method: "POST", body: JSON.stringify({ device, lines }) });
  try {
    assert.equal((await post("device01", ["one\nforged 2026 line"])).status, 200);
    const text = readFileSync(join(dir, "traces", "device01.log"), "utf8");
    assert.equal(text.trim().split("\n").length, 1, "a newline inside a line is one line");
    for (let i = 2; i <= 64; i++) await post(`device${String(i).padStart(2, "0")}`, ["x"]);
    assert.equal((await post("anotherone", ["x"])).status, 429, "past the number of devices we keep");
    assert.equal((await post("device01", ["still welcome"])).status, 200, "one we know carries on");
  } finally {
    await new Promise((done) => app.close(done));
  }
});

test("a key in an upstream address is not in what the health page says", async () => {
  const { redact } = await import("../src/http.js");
  assert.equal(redact("https://www.thesportsdb.com/api/v1/json/SECRETKEY123/eventsday.php?d=2026-10-03"), "https://www.thesportsdb.com/api/v1/json/…/eventsday.php?d=2026-10-03");
  assert.equal(redact("https://x.example/a?key=SECRET&b=1"), "https://x.example/a?key=…&b=1");
  const key = "SECRETKEY123456";
  const s = await serve({ config: { ...config, theSportsDbKey: key } });
  try {
    s.store.sportMeta("football").lastError = { at: "now", message: `HTTP 429 for https://www.thesportsdb.com/api/v1/json/${key}/eventsday.php` };
    const health = await (await s.get("/v1/health")).text();
    assert.ok(health.includes("HTTP 429"), "the error is still said");
    assert.ok(!health.includes(key), "scrubbed even if an error slipped through");
  } finally {
    await s.close();
  }
});

test("the health page is never more than a few seconds old, and a trace directory frees its oldest idle file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "tvscores-diag-"));
  const store = new Store(dir);
  const app = createApp({ store, config });
  await new Promise((done) => app.listen(0, "127.0.0.1", done));
  const { port } = app.address();
  const post = (device) => fetch(`http://127.0.0.1:${port}/tvscores/v1/diag`, { method: "POST", body: JSON.stringify({ device, lines: ["x"] }) });
  try {
    for (let i = 1; i <= 64; i++) await post(`device${String(i).padStart(2, "0")}`);
    assert.equal((await post("newcomer")).status, 429, "full, and everything in it is recent");
    const { utimesSync } = await import("node:fs");
    const old = new Date(Date.now() - 2 * 86400e3);
    utimesSync(join(dir, "traces", "device01.log"), old, old);
    assert.equal((await post("newcomer")).status, 200, "a device's trace untouched for two days makes room");
    store.sportMeta("football").calls = { day: "x", used: 1 };
    const one = await (await fetch(`http://127.0.0.1:${port}/tvscores/v1/health`)).json();
    store.sportMeta("football").calls = { day: "x", used: 2 };
    await new Promise((r) => setTimeout(r, 3100));
    const two = await (await fetch(`http://127.0.0.1:${port}/tvscores/v1/health`)).json();
    assert.equal(one.quota.football.used, 1);
    assert.equal(two.quota.football.used, 2, "three seconds on, the count is current");
  } finally {
    await new Promise((done) => app.close(done));
  }
});
