import test from "node:test";
import assert from "node:assert/strict";
import { Quota } from "../src/quota.js";

const cfg = { dailyQuota: 100, quotaReserve: 8 };
const noon = Date.UTC(2026, 8, 13, 12, 0, 0);

test("resets at UTC midnight and honours the reserve", () => {
  const meta = { calls: { day: "2026-09-12", used: 95 } };
  const q = new Quota(meta, cfg);
  assert.equal(q.remaining(noon), 100);
  assert.equal(q.spendable(noon), 92);
});

test("takes the upstream counter when it is higher", () => {
  const q = new Quota({ calls: { day: "", used: 0 } }, cfg);
  q.record(60, noon);
  assert.equal(q.remaining(noon), 60);
});

test("live interval stretches to fit the day", () => {
  const q = new Quota({ calls: { day: "2026-09-13", used: 0 } }, cfg);
  assert.equal(q.liveInterval(150, noon), Math.ceil((12 * 3600) / 92));
  q.meta.calls.used = 90;
  assert.equal(q.liveInterval(150, noon), Math.ceil((12 * 3600) / 2));
  q.meta.calls.used = 100;
  assert.equal(q.liveInterval(150, noon), 12 * 3600);
});

test("a missing rate-limit header does not zero the budget", async () => {
  const { getJson } = await import("../src/http.js");
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ response: [] }), { status: 200, headers: { "content-type": "application/json" } });
  try {
    const r = await getJson("https://example.test/x");
    assert.equal(r.remaining, undefined);
  } finally {
    globalThis.fetch = realFetch;
  }
});
