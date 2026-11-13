import test from "node:test";
import assert from "node:assert/strict";
import { section, topSection, closeSection, marketingOf, lastMarketing, buildsQuery } from "../testflight.mjs";

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

test("a build is looked for among its own platform's, when one is named", () => {
  assert.match(buildsQuery("IOS"), /&filter\[preReleaseVersion\.platform\]=IOS&/);
  assert.doesNotMatch(buildsQuery(), /platform/);
});

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
  const closed = closeSection(CHANGELOG, "12", "1.0", new Date("2026-09-16T12:00:00Z"));
  assert.match(closed, /^## 1\.0 build 12 — 16 September 2026$/m);
  // A fresh empty Unreleased is left open above it, so the next thing written
  // and the release job's own commit do not fight over the same line.
  assert.match(closed, /^## Unreleased$/m);
  // The entry itself survives; only the heading changes.
  assert.equal(section(closed, /build 12/), "- The icon sits on flat black now.\n- A second line.");
});

test("the heading carries the version the build was made with, not the last heading's", () => {
  // Build 47, the first of 1.1: the job wrote "1.0 build 47" (9 November 2026).
  const closed = closeSection(CHANGELOG, "47", "1.1", new Date("2026-11-09T00:30:00Z"));
  assert.match(closed, /^## 1\.1 build 47 — 9 November 2026$/m);
  assert.match(closed, /^## 1\.0 build 9 — /m, "the builds before it keep theirs");
});

test("the version is the one Apple read from the upload", () => {
  // The shape of App Store Connect's answer for build 47, 9 November 2026.
  const build = { type: "builds", id: "b47", attributes: { version: "47" },
    relationships: { preReleaseVersion: { data: { type: "preReleaseVersions", id: "p11" } } } };
  const included = [{ type: "preReleaseVersions", id: "p10", attributes: { version: "1.0" } },
    { type: "preReleaseVersions", id: "p11", attributes: { version: "1.1" } }];
  assert.equal(marketingOf(build, included), "1.1");
  assert.equal(marketingOf(build, []), undefined, "an answer without it says nothing");
  assert.equal(marketingOf(build), undefined);
});

test("without Apple's word, the heading keeps the last build's version", () => {
  assert.equal(lastMarketing(CHANGELOG), "1.0");
  assert.equal(lastMarketing("# Changelog\n\n## Unreleased\n\n- First.\n"), "1.0", "and 1.0 before any build");
});

test("closing twice changes nothing the second time", () => {
  const once = closeSection(CHANGELOG, "12", "1.0", new Date("2026-09-16T12:00:00Z"));
  assert.equal(closeSection(once, "13", "1.0", new Date("2026-09-17T12:00:00Z")), once);
});

test("an empty Unreleased section is left open", () => {
  const empty = "# Changelog\n\n## Unreleased\n\n## 1.0 build 9 — 15 September 2026\n\n- New app icon.\n";
  assert.equal(closeSection(empty, "12", "1.0", new Date("2026-09-16T12:00:00Z")), empty);
  assert.equal(topSection(empty), "", "and it sends no note rather than a placeholder");
});

test("closing a section leaves an empty one open behind it", () => {
  // The release job commits this file, and so does whoever is working while
  // a build uploads. Both used to rewrite the same line.
  const md = "# Changelog\n\n## Unreleased\n\n- Something visible.\n\n## 1.0 build 8 — 1 September 2026\n";
  const closed = closeSection(md, "9", "1.0", new Date("2026-09-17T12:00:00Z"));
  assert.match(closed, /## Unreleased\n\n## 1\.0 build 9 — 17 September 2026/);
  // The note is taken before the section is closed, so it is unaffected.
  assert.equal(topSection(md), "- Something visible.");
  assert.equal(section(closed, /build 9/), "- Something visible.", "and the entry sits under the build that shipped it");
  assert.equal(closeSection(closed, "10", "1.0", new Date("2026-09-17T12:00:00Z")), closed, "the empty one it left stays open");
});
