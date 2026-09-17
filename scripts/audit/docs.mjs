import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/** A document may not name a file that is not there. */
function paths({ docs, root, rel, read }, report) {
  for (const file of docs) {
    for (const [, path] of read(file).matchAll(/`((?:app|proxy|docs|scripts|\.github|src|test|assets|deploy)\/[\w./-]+)`/g)) {
      // A path is read from the repository root or from the document's own folder.
      if (!existsSync(join(root, path)) && !existsSync(join(dirname(file), path))) {
        report("docs", rel(file), `names ${path}, which does not exist`);
      }
    }
  }
}

/** Every route the server answers is written down, and nothing else is. */
function routes({ root, read }, report) {
  const server = read(join(root, "proxy/src/server.js"));
  const served = new Set([
    ...[...server.matchAll(/["'`](\/v1\/[\w/-]*)/g)].map((m) => m[1]),
    ...[...server.matchAll(/\/\^\\\/v1\\\/([\w-]+)/g)].map((m) => `/v1/${m[1]}`),
  ].map((r) => r.replace(/\/$/, "")));
  const doc = read(join(root, "proxy/README.md"));
  const stem = (route) => route.split("/").slice(0, 3).join("/");
  for (const route of served) {
    if (!doc.includes(stem(route))) report("docs", "proxy/README.md", `${stem(route)} is served but not documented`);
  }
  for (const [, route] of doc.matchAll(/`GET (\/v1\/[\w/{}.-]+)/g)) {
    if (![...served].some((r) => r.startsWith(stem(route)))) {
      report("docs", "proxy/README.md", `documents ${stem(route)}, which the server no longer serves`);
    }
  }
}

/**
 * Anything a tester could notice is supposed to be written down as it lands.
 *
 * A commit that changes the source without changing anything a tester could
 * notice says so with a `Changelog: none` trailer — a declaration a reviewer
 * can see and disagree with, rather than a line invented for the release
 * note to keep this check quiet.
 */
function changelog({ root, git }, report) {
  const lastEntry = git("log", "-1", "--format=%H", "--", "CHANGELOG.md");
  if (!lastEntry) return;
  const commits = git("log", `${lastEntry}..HEAD`, "--format=%h %s%x1f%B%x1e", "--", "app/Sources", "proxy/src")
    .split("\x1e")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => c.split("\x1f"));
  for (const [line, body] of commits) {
    if (/^Changelog:\s*none\s*$/mi.test(body)) continue;
    report("changelog", "CHANGELOG.md", `nothing written for ${line}`);
  }
}

/**
 * The README is the tour for a human arriving at the repository; AGENTS.md is
 * the commands, rules and conventions. A fact written in both goes stale in
 * one of them, which is how the README ended up still claiming the app is
 * built on a MacBook.
 */
function noDoubleTelling({ root, read }, report) {
  const sentences = (file) => {
    const prose = read(join(root, file))
      .replace(/```[\s\S]*?```/g, "\n\n")   // code blocks are meant to repeat
      .split("\n")
      .filter((line) => !/^\s*(#|\||>)/.test(line))  // headings, tables, quotes
      .map((line) => line.replace(/^\s*(?:[-*+]|\d+\.)\s+/, ""))
      .join("\n");
    return prose
      .split(/\n\s*\n/)
      // Emphasis comes off before the split, or "**Rule.** Next" never parts.
      .flatMap((para) => para.replace(/[`*_]/g, "").replace(/\s+/g, " ").split(/(?<=[.!?])\s+/))
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length >= 60);
  };
  const brief = new Set(sentences("AGENTS.md"));
  for (const line of sentences("README.md")) {
    if (brief.has(line)) report("docs", "README.md", `says what AGENTS.md already says: "${line.slice(0, 70)}..."`);
  }
}

export const checks = [paths, routes, changelog, noDoubleTelling];
