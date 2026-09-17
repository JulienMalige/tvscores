import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/cache.js";
import { createApp } from "../src/server.js";
import { config } from "../src/config.js";

/** Starts the app on an ephemeral port and returns a fetch bound to it. */
async function serve() {
  const store = new Store(mkdtempSync(join(tmpdir(), "tvscores-")));
  const app = createApp({ store, config });
  await new Promise((done) => app.listen(0, "127.0.0.1", done));
  const { port } = app.address();
  return {
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
