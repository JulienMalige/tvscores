import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ImageMirror } from "../src/images.js";

const BASE = "https://proxy.example/tvscores";
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");

function fakeFetch(plan) {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    const answer = typeof plan === "function" ? plan(url) : plan;
    if (answer instanceof Error) throw answer;
    const { status = 200, type = "image/png", body = PNG } = answer || {};
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (h) => (h.toLowerCase() === "content-type" ? type : null) },
      arrayBuffer: async () => body,
    };
  };
  impl.calls = calls;
  return impl;
}

function mirror(fetchImpl, opts = {}) {
  return new ImageMirror({ dir: mkdtempSync(join(tmpdir(), "tvscores-img-")), publicBase: BASE, fetchImpl, ...opts });
}

test("registers an upstream URL and hands back one of ours", () => {
  const m = mirror(fakeFetch({}));
  const url = m.url("https://cdn.example/team/10.png");
  assert.match(url, new RegExp(`^${BASE}/v1/img/[0-9a-f]{40}$`));
  assert.equal(m.url("https://cdn.example/team/10.png"), url, "same source, same address");
  assert.equal(m.entries.size, 1);
});

test("leaves our own URLs and empty values alone", () => {
  const m = mirror(fakeFetch({}));
  const own = `${BASE}/v1/assets/leagues/nfl.png`;
  assert.equal(m.url(own), own);
  assert.equal(m.url(undefined), undefined);
  assert.equal(m.url(null), undefined);
  assert.equal(m.entries.size, 0);
});

test("fetches the bytes once, then serves them from disk", async () => {
  const f = fakeFetch({});
  const m = mirror(f);
  const key = ImageMirror.key("https://cdn.example/a.png");
  m.url("https://cdn.example/a.png");

  const first = await m.serve(key);
  assert.equal(first.type, "image/png");
  assert.deepEqual(first.body, PNG);
  assert.equal(f.calls.length, 1);

  const second = await m.serve(key);
  assert.deepEqual(second.body, PNG);
  assert.equal(f.calls.length, 1, "the second request must not hit the network");
});

test("an unreachable image redirects to the original instead of failing", async () => {
  const m = mirror(fakeFetch({ status: 503 }));
  const src = "https://cdn.example/gone.png";
  m.url(src);
  const hit = await m.serve(ImageMirror.key(src));
  assert.deepEqual(hit, { redirect: src });
  assert.equal(m.entries.get(ImageMirror.key(src)).fails, 1);
});

test("refuses anything that is not an image", async () => {
  const m = mirror(fakeFetch({ type: "text/html" }));
  const src = "https://cdn.example/login.html";
  m.url(src);
  const hit = await m.serve(ImageMirror.key(src));
  assert.ok(hit.redirect, "a login page is not a crest");
});

test("an unknown key is a miss, not a redirect", async () => {
  const m = mirror(fakeFetch({}));
  assert.equal(await m.serve("0".repeat(40)), null);
});

test("stops retrying a URL that keeps failing", async () => {
  const m = mirror(fakeFetch({ status: 404 }));
  const src = "https://cdn.example/never.png";
  const key = ImageMirror.key(src);
  m.url(src);
  for (let i = 0; i < 5; i++) await m.fetchOne(key);
  assert.equal(m.pending().includes(key), false);
});

test("the manifest survives a restart, bytes included", async () => {
  const f = fakeFetch({});
  const dir = mkdtempSync(join(tmpdir(), "tvscores-img-"));
  const src = "https://cdn.example/keep.png";
  const key = ImageMirror.key(src);

  const first = new ImageMirror({ dir, publicBase: BASE, fetchImpl: f });
  first.url(src);
  await first.warm();
  first.stop();

  const again = new ImageMirror({ dir, publicBase: BASE, fetchImpl: f });
  const hit = await again.serve(key);
  assert.deepEqual(hit.body, PNG);
  assert.equal(f.calls.length, 1, "a restart must not refetch what is already on disk");
  assert.deepEqual(again.stats(), { known: 1, stored: 1, pending: 0, megabytes: 0 });
});

test("prunes images nothing has asked for, and files with no entry", async () => {
  const f = fakeFetch({});
  const m = mirror(f, { maxAgeDays: 30 });
  const src = "https://cdn.example/old.png";
  const key = ImageMirror.key(src);
  m.url(src);
  await m.warm();
  writeFileSync(join(m.dir, "deadbeef.png"), PNG); // no manifest entry

  m.entries.get(key).lastUsed = Date.now() - 31 * 86400e3;
  const dropped = m.prune();

  assert.equal(dropped, 2);
  assert.equal(m.entries.size, 0);
  assert.deepEqual(readdirSync(m.dir), ["index.json"]);
  assert.equal(existsSync(join(m.dir, `${key}.png`)), false);
});

test("naming an image keeps it alive through a prune", async () => {
  const m = mirror(fakeFetch({}), { maxAgeDays: 30 });
  const src = "https://cdn.example/still-used.png";
  m.url(src);
  await m.warm();
  m.entries.get(ImageMirror.key(src)).lastUsed = Date.now() - 31 * 86400e3;

  m.url(src); // the next scoreboard names it again
  assert.equal(m.prune(), 0);
  assert.equal(m.entries.size, 1);
});

test("a dead link stops crowding out images never tried", async () => {
  const dead = "https://cdn.example/dead.png";
  const fresh = "https://cdn.example/fresh.png";
  const f = fakeFetch((url) => (url === dead ? { status: 404 } : {}));
  const m = mirror(f);
  m.url(dead);
  for (let i = 0; i < 5; i++) await m.fetchOne(ImageMirror.key(dead));
  m.url(fresh);
  assert.deepEqual(m.pending(), [ImageMirror.key(fresh)]);
});

test("a copy on disk is refreshed only after the ones we lack", async () => {
  const f = fakeFetch({});
  const m = mirror(f, { refreshDays: 30 });
  const old = "https://cdn.example/old.png";
  const never = "https://cdn.example/never-had.png";
  m.url(old);
  await m.warm();
  m.entries.get(ImageMirror.key(old)).fetchedAt = Date.now() - 31 * 86400e3;
  m.url(never);
  assert.deepEqual(m.pending(), [ImageMirror.key(never), ImageMirror.key(old)]);
});

test("gives up on a hung upstream instead of hanging the television", async () => {
  const hang = async (_url, opts) => new Promise((_, reject) => {
    opts.signal.addEventListener("abort", () => reject(new Error("aborted")));
  });
  const m = mirror(hang, { timeoutMs: 30 });
  const src = "https://cdn.example/slow.png";
  m.url(src);
  assert.deepEqual(await m.serve(ImageMirror.key(src)), { redirect: src });
});
