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

/** Anything a tester could notice is supposed to be written down as it lands. */
function changelog({ root, git }, report) {
  const lastEntry = git("log", "-1", "--format=%H", "--", "CHANGELOG.md");
  if (!lastEntry) return;
  const since = git("log", `${lastEntry}..HEAD`, "--format=%h %s", "--", "app/Sources", "proxy/src")
    .split("\n")
    .filter(Boolean);
  for (const commit of since) report("changelog", "CHANGELOG.md", `nothing written for ${commit}`);
}

export const checks = [paths, routes, changelog];
