import test from "node:test";
import assert from "node:assert/strict";
import { AppIcons } from "../src/app-icons.js";
import { createWatch } from "../src/watch.js";

const table = {
  apps: {
    a: { name: "A", kind: "own", appStoreId: 11, tvos: ["FR"] },
    b: { name: "B", kind: "streamer", appStoreId: { US: 22, BR: 33 }, tvos: ["US"], schemes: ["b://"] },
    c: { name: "C", kind: "provider", appStoreId: null, tvos: [], builtIn: true },
  },
  channels: {},
};
const listing = (url) => ({ body: { results: [{ artworkUrl512: url, supportedDevices: ["AppleTV"] }] } });

function icons(fetch, now = () => 1_000_000) {
  const store = { appIcons: {}, touch() {} };
  return { store, icons: new AppIcons({ table, store, fetch, now }) };
}

test("an icon is asked for once per app with a store id, in the country it has a tvOS app in", async () => {
  const asked = [];
  const { icons: i, store } = icons(async (url) => { asked.push(url); return listing(`https://img/${asked.length}.jpg`); });
  assert.deepEqual(i.due(), ["a", "b"], "the built-in app has no store id to ask");
  const realSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => realSetTimeout(fn, 0); // the gap between asks is not what is tested
  try {
    assert.equal(await i.fill(), 2);
  } finally {
    globalThis.setTimeout = realSetTimeout;
  }
  assert.deepEqual(asked, ["https://itunes.apple.com/lookup?id=11&country=fr&entity=tvSoftware", "https://itunes.apple.com/lookup?id=22&country=us&entity=tvSoftware"]);
  assert.equal(i.get("a"), "https://img/1.jpg");
  assert.deepEqual(i.due(), [], "nothing is due for a week");
  assert.equal(i.due(1_000_000 + 8 * 86400e3).length, 2, "and then both are");
  assert.ok(store.appIcons.b.at);
});

test("a listing that is not there, or an error, leaves the app without an icon and asks nothing more", async () => {
  const { icons: i } = icons(async (url) => { if (url.includes("id=11")) throw new Error("HTTP 403"); return { body: { results: [] } }; });
  const realSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => realSetTimeout(fn, 0);
  try {
    assert.equal(await i.fill(), 0);
  } finally {
    globalThis.setTimeout = realSetTimeout;
  }
  assert.equal(i.get("a"), undefined);
  assert.equal(i.get("b"), undefined);
});

test("the board describes an app with its icon and the schemes to try, and omits what it lacks", () => {
  const watch = createWatch(table);
  const cards = watch.describe(new Set(["a", "b", "c"]), (key) => (key === "b" ? "https://proxy/v1/img/abc" : undefined));
  assert.deepEqual(cards.a, { name: "A", kind: "own", id: 11 });
  assert.deepEqual(cards.b, { name: "B", kind: "streamer", id: { US: 22, BR: 33 }, schemes: ["b://"], icon: "https://proxy/v1/img/abc" });
  assert.equal(cards.c.builtIn, true);
});

test("the tvOS app's own wide icon is the one kept, and an icon kept from before it is asked for again", async () => {
  const body = { results: [{ artworkUrl512: "https://img/iphone.jpg", supportedDevices: ["iPhone"] }, { artworkUrl512: "https://img/tv.jpg", supportedDevices: ["AppleTV"] }] };
  const { icons: i, store } = icons(async () => ({ body }));
  store.appIcons.a = { url: "https://img/old-square.jpg", at: 1_000_000 }; // before the wide icons: no `tv`
  assert.ok(i.due().includes("a"), "stale: it was the iPhone's");
  const realSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => realSetTimeout(fn, 0);
  try {
    await i.fill();
  } finally {
    globalThis.setTimeout = realSetTimeout;
  }
  assert.equal(i.get("a"), "https://img/tv.jpg");
  assert.equal(store.appIcons.a.tv, true);
});
