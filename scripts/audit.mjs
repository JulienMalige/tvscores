#!/usr/bin/env node
/**
 * Daily health check on the source itself: the things that rot quietly between
 * commits. Static, zero dependencies, one command.
 *
 *   node scripts/audit.mjs          report and exit 1 on any finding
 *   node scripts/audit.mjs --quiet  only the summary line
 *
 * What it cannot judge (whether a comment earns its place, whether a file
 * still has one job beyond its length) is left to a person. Everything here is
 * a fact, so a finding is never a matter of taste.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { checks as source } from "./audit/source.mjs";
import { checks as docs } from "./audit/docs.mjs";
import { checks as secrets } from "./audit/secrets.mjs";
import { checks as tests } from "./audit/tests.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["node_modules", ".git", "build", "DerivedData", "fixtures", "assets", ".github"]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

const cache = new Map();
const files = walk(ROOT);
const jsAll = files.filter((f) => f.endsWith(".js") || f.endsWith(".mjs"));
const swift = files.filter((f) => f.endsWith(".swift"));

const context = {
  root: ROOT,
  files,
  jsAll,
  swift,
  js: files.filter((f) => f.endsWith(".js") && f.includes(join("proxy", "src"))),
  docs: files.filter((f) => f.endsWith(".md")),
  sources: [...jsAll, ...swift],
  rel: (p) => relative(ROOT, p),
  read: (p) => {
    if (!cache.has(p)) cache.set(p, readFileSync(p, "utf8"));
    return cache.get(p);
  },
  run: (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }),
  git: (...args) => {
    // A shallow checkout has no history to read; the workflow fetches it.
    try {
      return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
    } catch {
      return "";
    }
  },
};

const findings = [];
const state = { coverage: null };
const report = (check, where, what) => findings.push({ check, where, what });
for (const check of [...source, ...docs, ...secrets, ...tests]) check(context, report, state);

if (!process.argv.includes("--quiet")) {
  const byCheck = new Map();
  for (const f of findings) {
    if (!byCheck.has(f.check)) byCheck.set(f.check, []);
    byCheck.get(f.check).push(f);
  }
  for (const [check, list] of byCheck) {
    console.log(`\n${check} (${list.length})`);
    for (const f of list) console.log(`  ${f.where}: ${f.what}`);
  }
}
const { coverage } = state;
console.log(`\n${findings.length} finding${findings.length === 1 ? "" : "s"}${coverage === null ? "" : `, proxy coverage ${coverage}%`}`);
process.exit(findings.length ? 1 : 0);
