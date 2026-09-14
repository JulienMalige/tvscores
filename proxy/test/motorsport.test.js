import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normaliseEvent } from "../src/providers/ocblacktop.js";

const fx = JSON.parse(readFileSync(new URL("./fixtures/ocb-f1.json", import.meta.url)));
const F1 = { id: "f1", name: "Formula 1", short: "F1" };
const [spain, future, testing] = fx.events;

test("completed grand prix with podium, gaps and flags", () => {
  const e = normaliseEvent(spain, { sport: "formula1", league: F1, results: fx.results, nationalities: { Antonelli: "Italian", Verstappen: "Dutch" } });
  assert.equal(e.kind, "race");
  assert.equal(e.status.state, "final");
  assert.equal(e.start, "2026-09-13T13:00:00.000Z");
  assert.equal(e.name, "Spanish Grand Prix");
  assert.equal(e.results.length, 3);
  assert.deepEqual(e.results.map((r) => r.pos), [1, 2, 3]);
  assert.equal(e.results[0].gap, "1:34:23.754");
  assert.equal(e.results[1].gap, "+4.351s");
  assert.equal(e.results[0].flag, "🇮🇹");
  assert.equal(e.results[2].flag, undefined);
  assert.equal(e.results[0].code, "ANT");
  assert.match(e.results[1].teamColor, /^#/);
});

test("motogp bare displayTime becomes a +gap", () => {
  const rows = [
    { position: "1", lapTime: "41:13.013", displayTime: "0.000", gap: null, status: "INSTND", driver: { firstName: "Marc", lastName: "Marquez" }, team: { shortName: "Ducati" } },
    { position: "2", lapTime: "41:13.670", displayTime: "0.657", gap: null, status: "INSTND", driver: { firstName: "Alex", lastName: "Marquez" }, team: { shortName: "Gresini" } },
    { position: "3", lapTime: "41:15.339", displayTime: "+1 lap", gap: null, status: "INSTND", driver: { firstName: "Pedro", lastName: "Acosta" }, team: { shortName: "KTM" } },
  ];
  const e = normaliseEvent(spain, { sport: "moto-gp", league: { id: "motogp", name: "MotoGP", short: "MotoGP" }, results: rows });
  assert.deepEqual(e.results.map((r) => r.gap), ["41:13.013", "+0.657s", "+1 lap"]);
});

test("scheduled round has no results; live inside the race window", () => {
  const e = normaliseEvent(future, { sport: "formula1", league: F1 });
  assert.equal(e.status.state, "scheduled");
  assert.equal(e.results, undefined);
  const live = normaliseEvent(future, { sport: "formula1", league: F1, now: Date.parse(e.start) + 60e3 });
  assert.equal(live.status.state, "live");
});

test("weeks without a race session are skipped; shouting names are title-cased", () => {
  if (testing) assert.equal(normaliseEvent(testing, { sport: "formula1", league: F1 }), null);
  const loud = { ...spain, name: "GRAND PRIX OF SAN MARINO" };
  assert.equal(normaliseEvent(loud, { sport: "moto-gp", league: { id: "motogp", name: "MotoGP", short: "MotoGP" } }).name, "Grand Prix of San Marino");
});
