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
    s.store.upsert([{ id: "x:1", sport: "football", league: { id: 1, name: "L" }, start: "not a date", status: { state: "scheduled" }, home: { name: "A" }, away: { name: "B" } }]);
    const res = await s.get("/v1/scoreboard?tz=UTC");
    assert.equal(res.status, 200, "the unreadable date is left off, not fatal");
    const plain = await fetch(`http://127.0.0.1:${s.port}/tvscores/v1/scoreboard?tz=UTC`, { headers: { "accept-encoding": "identity" } });
    assert.equal(plain.headers.get("content-encoding"), null);
    const gz = await s.get("/v1/scoreboard?tz=UTC", { "accept-encoding": "gzip" });
    assert.equal(gz.status, 200);
    assert.ok(await gz.json(), "decoded by fetch");
  } finally {
    await s.close();
  }
});

test("a 304 stands for a few minutes at most, so a television's clock cannot go stale", async () => {
  const s = await serve();
  const realNow = Date.now;
  try {
    const first = await s.get("/v1/scoreboard?tz=UTC");
    const tag = first.headers.get("etag");
    assert.equal((await s.get("/v1/scoreboard?tz=UTC", { "if-none-match": tag })).status, 304);
    Date.now = () => realNow() + 6 * 60e3; // past the window, and past the memo
    const later = await s.get("/v1/scoreboard?tz=UTC", { "if-none-match": tag });
    assert.equal(later.status, 200, "after five minutes the body is sent again");
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
