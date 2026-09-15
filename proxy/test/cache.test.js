import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/cache.js";

/** A store on disk written by an older version of the proxy. */
function oldStore(schemaVersion) {
  const dir = mkdtempSync(join(tmpdir(), "tvscores-"));
  writeFileSync(join(dir, "store.json"), JSON.stringify({
    schemaVersion,
    events: [{ id: "football:12345", sport: "football", status: { state: "final" } }],
    photos: { "Max Verstappen": { url: "https://example.test/mv.png", at: "2026-09-01" } },
    meta: { football: { lastDaily: "2026-09-15T10:00:00.000Z", calls: { day: "2026-09-15", used: 12 } } },
  }));
  return dir;
}

test("a store written by this version is read back whole", () => {
  const store = new Store(oldStore(6));
  assert.equal(store.all().length, 1);
  assert.equal(Object.keys(store.photos).length, 1);
  assert.equal(store.sportMeta("football").lastDaily, "2026-09-15T10:00:00.000Z");
});

test("an older store is emptied so a provider swap cannot double up", () => {
  // The events were keyed by the previous provider's ids. Keeping them would
  // show the same match twice, once under each provider's id.
  const store = new Store(oldStore(5));
  assert.equal(store.all().length, 0);
  assert.deepEqual(store.photos, {});
  assert.equal(store.sportMeta("football").lastDaily, undefined, "and today's fetch stamp goes too, or nothing refills for hours");
  assert.deepEqual(store.sportMeta("football").calls, { day: "2026-09-15", used: 12 }, "but the quota spent today is still spent");
});
