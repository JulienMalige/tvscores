import test from "node:test";
import assert from "node:assert/strict";
import { withPhotos, withTablePhotos } from "../src/scoreboard.js";

const photoFor = (n) => ({ "Kimi Antonelli": "https://x/ant.png", "Jannik Sinner": "https://x/sin.png" }[n]);

test("podium rows and tennis players get cached photos", () => {
  const race = { sport: "f1", results: [{ pos: 1, driver: "K. Antonelli", fullName: "Kimi Antonelli" }, { pos: 2, driver: "M. Verstappen", fullName: "Max Verstappen" }] };
  const out = withPhotos(race, photoFor);
  assert.equal(out.results[0].photo, "https://x/ant.png");
  assert.equal(out.results[1].photo, undefined);
  const match = { sport: "tennis", home: { name: "Jannik Sinner" }, away: { name: "Nobody" } };
  const m = withPhotos(match, photoFor);
  assert.equal(m.home.photo, "https://x/sin.png");
  assert.equal(m.away.photo, undefined);
  assert.equal(match.home.photo, undefined, "input is not mutated");
});

test("standings tables get photos by full name", () => {
  const st = { tables: [{ id: "drivers", rows: [{ pos: 1, name: "K. Antonelli", fullName: "Kimi Antonelli" }] }] };
  assert.equal(withTablePhotos(st, photoFor).tables[0].rows[0].photo, "https://x/ant.png");
});
