import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/cache.js";
import { createApp } from "../src/server.js";
import { config } from "../src/config.js";

/** Starts the app on an ephemeral port and returns a fetch bound to it. */
async function serve(extra = {}) {
  const store = new Store(mkdtempSync(join(tmpdir(), "tvscores-")));
  const app = createApp({ store, config, ...extra });
  await new Promise((done) => app.listen(0, "127.0.0.1", done));
  const { port } = app.address();
  return {
    store,
    port,
    get: (path, headers) => fetch(`http://127.0.0.1:${port}${config.pathPrefix}${path}`, { headers }),
    close: () => new Promise((done) => app.close(done)),
  };
}

test("the scoreboard carries an ETag, and repeats it as a bodyless 304", async () => {
  const s = await serve();
  try {
    const first = await s.get("/v1/scoreboard?tz=America/Sao_Paulo");
    assert.equal(first.status, 200);
    const etag = first.headers.get("etag");
    assert.ok(etag, "an ETag is sent");
    assert.ok((await first.text()).length > 0);

    const again = await s.get("/v1/scoreboard?tz=America/Sao_Paulo", { "if-none-match": etag });
    assert.equal(again.status, 304, "the television is told nothing changed");
    assert.equal(again.headers.get("etag"), etag);
    assert.equal((await again.text()).length, 0, "and spends no bytes on 50 KB it already has");

    const stale = await s.get("/v1/scoreboard?tz=America/Sao_Paulo", { "if-none-match": '"something-else"' });
    assert.equal(stale.status, 200, "an ETag we do not recognise gets the body");
  } finally {
    await s.close();
  }
});

test("the tag follows the content, not the clock", async () => {
  const s = await serve();
  try {
    const one = await s.get("/v1/scoreboard?tz=America/Sao_Paulo");
    const other = await s.get("/v1/scoreboard?tz=Europe/Paris");
    assert.notEqual(one.headers.get("etag"), other.headers.get("etag"), "different board, different tag");
  } finally {
    await s.close();
  }
});

test("a competition's badge is served in both shapes, and nothing else is", async () => {
  const s = await serve();
  try {
    const wide = await s.get("/v1/assets/leagues/f1.png");
    assert.equal(wide.status, 200, "the wordmark, at its own proportions");
    const round = await s.get("/v1/assets/leagues/icon/f1.png");
    assert.equal(round.status, 200, "and the bare mark the sidebar uses");
    assert.equal(round.headers.get("content-type"), "image/png");

    assert.equal((await s.get("/v1/assets/leagues/nope.png")).status, 404);
    assert.equal((await s.get("/v1/assets/leagues/icon/nope.png")).status, 404);
    // The path is an alternative, not a free one: no walking out of assets/.
    assert.equal((await s.get("/v1/assets/leagues/../../package.png")).status, 404);
  } finally {
    await s.close();
  }
});

test("every image says how long it is", async () => {
  // Without a length the response is chunked and the client is guessing. A
  // television that gives up on a guess shows a monogram and never asks again.
  const s = await serve();
  try {
    for (const path of ["/v1/assets/leagues/f1.png", "/v1/assets/leagues/icon/f1.png"]) {
      const res = await s.get(path);
      assert.equal(res.status, 200, path);
      assert.ok(Number(res.headers.get("content-length")) > 0, `${path} has a content-length`);
    }
  } finally {
    await s.close();
  }
});

test("one league's table is served, and a league without one says so", async () => {
  const s = await serve();
  try {
    s.store.setStandings("football", "4335", { updatedAt: "2026-09-16T00:00:00Z", tables: [{ id: "table", rows: [{ pos: 1, name: "Real Madrid", value: 9 }] }] });
    const hit = await s.get("/v1/standings/football/4335");
    assert.equal(hit.status, 200);
    const body = await hit.json();
    assert.equal(body.tables[0].rows[0].name, "Real Madrid");
    assert.ok(hit.headers.get("etag"), "a table carries an ETag like the board");
    const miss = await s.get("/v1/standings/football/4480");
    assert.equal(miss.status, 404, "a cup has no table; the app shows 'unavailable', not a blank page");
    const all = await (await s.get("/v1/standings")).json();
    assert.deepEqual(Object.keys(all.standings), ["football:4335"]);
  } finally {
    await s.close();
  }
});

test("a time zone we cannot name is refused before it can mis-bucket a day", async () => {
  const s = await serve();
  try {
    assert.equal((await s.get("/v1/scoreboard?tz=Mars/Olympus")).status, 400);
    assert.equal((await s.get("/v1/fixtures?tz=UTC&date=yesterday")).status, 400, "and a date has one shape");
    assert.equal((await s.get("/v1/nothing")).status, 404);
  } finally {
    await s.close();
  }
});

test("health reports the day's spend against each sport's cap, and is never cached", async () => {
  const s = await serve({ limits: { football: 5000 } });
  try {
    s.store.sportMeta("football").calls = { day: "2026-09-16", used: 12 };
    s.store.sportMeta("f1").calls = { day: "2026-09-16", used: 3 };
    const res = await s.get("/v1/health");
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "no-store");
    const { ok, quota } = await res.json();
    assert.equal(ok, true);
    assert.deepEqual([quota.football.used, quota.football.limit, quota.football.remaining], [12, 5000, 4988]);
    assert.equal(quota.f1.limit, null, "a sport with no known cap says so rather than inventing one");
  } finally {
    await s.close();
  }
});

test("a country's flag is served flat and square, by its two-letter code only", async () => {
  const s = await serve();
  try {
    const az = await s.get("/v1/assets/flags/az.png");
    assert.equal(az.status, 200);
    assert.equal(az.headers.get("content-type"), "image/png");
    assert.ok(Number(az.headers.get("content-length")) > 500, "and says how long it is");
    assert.equal((await s.get("/v1/assets/flags/qq.png")).status, 404, "a code we have no flag for");
    assert.equal((await s.get("/v1/assets/flags/gb-eng.png")).status, 404, "subdivisions are not served");
    assert.equal((await s.get("/v1/assets/flags/AZ.png")).status, 404, "lower-case only, as the app spells it");
  } finally {
    await s.close();
  }
});

test("a television's trace is filed under its device, and junk is refused", async () => {
  const s = await serve();
  try {
    const post = (body) => fetch(`http://127.0.0.1:${s.port}${config.pathPrefix}/v1/diag`, { method: "POST", body, headers: { "content-type": "application/json" } });
    const ok = await post(JSON.stringify({ device: "abcd1234", lines: ["  0.100 app launched", "  1.200 focus left A -> B"] }));
    assert.equal(ok.status, 200);
    const trace = readFileSync(join(s.store.dir, "traces", "abcd1234.log"), "utf8");
    assert.match(trace, /app launched/);
    assert.match(trace, /focus left A -> B/);
    assert.equal((await post("not json")).status, 400);
    assert.equal((await post(JSON.stringify({ device: "../etc", lines: [] }))).status, 400, "a device is a token, not a path");
  } finally {
    await s.close();
  }
});
