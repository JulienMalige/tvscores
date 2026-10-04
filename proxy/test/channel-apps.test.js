import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const table = JSON.parse(readFileSync(new URL("../channel-apps.json", import.meta.url), "utf8"));
const COUNTRIES = ["FR", "US", "BR"];
const KINDS = ["own", "streamer", "provider"];

test("every app says what it is, where it has a tvOS version, and how to find it", () => {
  for (const [key, app] of Object.entries(table.apps)) {
    assert.ok(app.name, `${key} has a name`);
    assert.ok(KINDS.includes(app.kind), `${key}: kind is one of ${KINDS}`);
    assert.ok(Array.isArray(app.tvos) && app.tvos.every((c) => COUNTRIES.includes(c)), `${key}: tvos lists countries we carry`);
    const id = app.appStoreId;
    const ok = app.builtIn ? id === null : Number.isInteger(id) || (id && Object.values(id).every(Number.isInteger) && Object.keys(id).every((c) => COUNTRIES.includes(c)));
    assert.ok(ok, `${key}: an App Store id (a number, or one per country), or built in`);
    for (const scheme of app.schemes || []) assert.match(scheme, /^[a-z][a-z0-9.+-]*:\/\/$/i, `${key}: a scheme is "name://"`);
  }
});

test("every channel names apps that exist, none twice, and every app is somebody's", () => {
  const used = new Set();
  for (const country of COUNTRIES) {
    for (const [channel, apps] of Object.entries(table.channels[country])) {
      assert.ok(apps.length > 0, `${country} ${channel} has an app`);
      assert.equal(new Set(apps).size, apps.length, `${country} ${channel} lists no app twice`);
      for (const a of apps) {
        assert.ok(table.apps[a], `${country} ${channel}: ${a} is defined`);
        used.add(a);
      }
    }
  }
  assert.deepEqual(Object.keys(table.apps).filter((a) => !used.has(a)), [], "no app that no channel uses");
});

test("a channel in a country has at least one app a television there can open", () => {
  for (const country of COUNTRIES) {
    for (const [channel, apps] of Object.entries(table.channels[country])) {
      const openable = apps.filter((a) => table.apps[a].tvos.includes(country) || table.apps[a].builtIn);
      assert.ok(openable.length > 0, `${country} ${channel}: ${apps.join(", ")} has no tvOS app in ${country}`);
    }
  }
});

test("the table lists nothing under Vivo Play, whose app carries no sport", () => {
  assert.equal(table.apps.vivoplay, undefined);
});
