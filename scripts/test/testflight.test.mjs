import test from "node:test";
import assert from "node:assert/strict";
import { section, topSection, closeSection } from "../testflight.mjs";

const CHANGELOG = `# Changelog

Some preamble that is not a section.

## Unreleased

- The icon sits on flat black now.
- A second line.

## 1.0 build 9 — 15 September 2026

- New app icon.

## 1.0 build 8 — 14 September 2026

- Constructor badges.
`;

test("the note is the newest section, without its heading", () => {
  assert.equal(topSection(CHANGELOG), "- The icon sits on flat black now.\n- A second line.");
});

test("a section can be picked by its heading", () => {
  assert.equal(section(CHANGELOG, /build 8/), "- Constructor badges.");
  assert.equal(section(CHANGELOG, /build 9/), "- New app icon.");
});

test("no sections at all is an empty note, not a crash", () => {
  assert.equal(topSection("# Changelog\n\nnothing here yet\n"), "");
  assert.equal(section(CHANGELOG, /build 404/), "");
});

test("a note is capped so App Store Connect will take it", () => {
  const huge = `## Unreleased\n\n${"x".repeat(5000)}\n`;
  assert.equal(topSection(huge).length, 4000);
});

test("shipping a build closes the section it took", () => {
  const closed = closeSection(CHANGELOG, "12", new Date("2026-09-16T12:00:00Z"));
  assert.match(closed, /^## 1\.0 build 12 — 16 September 2026$/m);
  assert.doesNotMatch(closed, /^## Unreleased$/m);
  // The entry itself survives; only the heading changes.
  assert.equal(section(closed, /build 12/), "- The icon sits on flat black now.\n- A second line.");
});

test("the marketing version is carried over from the last build", () => {
  const next = CHANGELOG.replace("1.0 build 9", "1.1 build 9");
  assert.match(closeSection(next, "12", new Date("2026-09-16T12:00:00Z")), /## 1\.1 build 12 —/);
});

test("closing twice changes nothing the second time", () => {
  const once = closeSection(CHANGELOG, "12", new Date("2026-09-16T12:00:00Z"));
  assert.equal(closeSection(once, "13", new Date("2026-09-17T12:00:00Z")), once);
});
