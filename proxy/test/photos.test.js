import test from "node:test";
import assert from "node:assert/strict";
import { withPhotos, withTablePhotos } from "../src/scoreboard.js";
import { pickPlayer, normalise, photoKey } from "../src/photos.js";

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

test("photo pick needs an exact, accent-insensitive name and the right sport", () => {
  const players = [
    { strPlayer: "Marc Márquez", strSport: "Motorsport", strCutout: "https://x/mm.png" },
    { strPlayer: "Marc Marquez Jr", strSport: "Motorsport", strCutout: "https://x/junior.png" },
    { strPlayer: "Marc Marquez", strSport: "Soccer", strCutout: "https://x/soccer.png" },
  ];
  assert.equal(pickPlayer(players, "Marc Marquez", "motogp"), null, "Márquez and Marquez Jr are two exact hits: ambiguous");
  assert.equal(pickPlayer([players[0], players[2]], "Marc Marquez", "motogp").strCutout, "https://x/mm.png");
  assert.equal(pickPlayer(players, "Marc Marquez", "tennis"), null);
  assert.equal(pickPlayer([players[1]], "Marc Marquez", "motogp").strCutout, "https://x/junior.png", "a lone Jr is the same name");
  assert.equal(pickPlayer(players.slice(0, 2), "Marquez", "motogp"), null, "ambiguous superset is rejected");
  const kimi = [{ strPlayer: "Andrea Kimi Antonelli", strSport: "Motorsport", strCutout: "https://x/kimi.png" }, { strPlayer: "Marco Antonelli", strSport: "Motorsport", strCutout: "https://x/other.png" }];
  assert.equal(pickPlayer(kimi, "Kimi Antonelli", "f1").strCutout, "https://x/kimi.png");
  assert.equal(pickPlayer(kimi, "K. Antonelli", "f1"), null, "abbreviated names never match");
  assert.equal(normalise("Álex  Márquez"), "alex marquez");
});

test("namesakes in the same sport are refused; odd letters normalise", () => {
  const two = [
    { strPlayer: "Carlos Sainz", strSport: "Motorsport", strCutout: "https://x/dad.png" },
    { strPlayer: "Carlos Sainz", strSport: "Motorsport", strCutout: "https://x/son.png" },
  ];
  assert.equal(pickPlayer(two, "Carlos Sainz", "f1"), null);
  assert.equal(normalise("Novak Đoković"), "novak djokovic");
  assert.equal(normalise("Łukasz Kubot"), "lukasz kubot");
});

test("photoKey: people by full name, never teams or abbreviations", () => {
  assert.equal(photoKey({ fullName: "Kimi Antonelli", name: "K. Antonelli" }), "Kimi Antonelli");
  assert.equal(photoKey({ name: "K. Antonelli" }), undefined);
  assert.equal(photoKey({ name: "Jannik Sinner" }), "Jannik Sinner");
  assert.equal(photoKey({ name: "Mercedes", kind: "team" }), undefined);
});

test("symmetric related match with the same surname", () => {
  const tsdb = [{ strPlayer: "Kimi Antonelli", strSport: "Motorsport", strCutout: "https://x/k.png" }];
  assert.equal(pickPlayer(tsdb, "Andrea Kimi Antonelli", "f1").strCutout, "https://x/k.png");
  assert.equal(pickPlayer(tsdb, "Andrea Kimi Rossi", "f1"), null);
});
