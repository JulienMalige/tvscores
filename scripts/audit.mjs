#!/usr/bin/env node
/**
 * Daily health check on the source itself: things that rot quietly between
 * commits. Static only, zero dependencies, one command.
 *
 *   node scripts/audit.mjs          report and exit 1 on any finding
 *   node scripts/audit.mjs --quiet  only the summary line
 *
 * What it cannot judge (whether a comment earns its place, whether a file
 * still has one job) is left to a person or to the review that runs before a
 * push. Everything here is a fact, so a finding is never a matter of taste.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, basename, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["node_modules", ".git", "build", "DerivedData", "fixtures", "assets", ".github"]);
const MAX_LINES = 260;
const COVERAGE_FLOOR = 70;

const findings = [];
const report = (check, where, what) => findings.push({ check, where, what });

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

const files = walk(ROOT);
const rel = (p) => relative(ROOT, p);
const read = (p) => readFileSync(p, "utf8");
const js = files.filter((f) => f.endsWith(".js") && f.includes(`${"proxy"}/src`));
const jsAll = files.filter((f) => f.endsWith(".js") || f.endsWith(".mjs"));
const swift = files.filter((f) => f.endsWith(".swift"));
const docs = files.filter((f) => f.endsWith(".md"));
const sources = [...jsAll, ...swift];

// ---------------------------------------------------------------- dead code
// An export nothing else names is either dead or a test-only seam.
for (const file of js) {
  const text = read(file);
  const exported = [...text.matchAll(/^export\s+(?:async\s+)?(?:function|class|const|let)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
  for (const name of exported) {
    const used = sources.some((other) => other !== file && new RegExp(`\\b${name}\\b`).test(read(other)));
    if (!used) report("dead code", rel(file), `exports ${name}, nothing imports it`);
  }
}

// A module no one imports is dead weight, entry points aside.
const ENTRY = new Set(["proxy/src/index.js"]);
for (const file of js) {
  if (ENTRY.has(rel(file))) continue;
  const name = basename(file);
  const imported = jsAll.some((other) => other !== file && read(other).includes(`/${name}"`));
  if (!imported) report("dead code", rel(file), "no module imports this file");
}

// Swift types and free functions declared once and never named again.
for (const file of swift) {
  const text = read(file);
  // @main is named by the runtime, not by our code.
  const declared = [...text.matchAll(/^(?!@)(?:public\s+|private\s+|final\s+)*(?:struct|enum|actor|class)\s+([A-Z][\w]*)/gm)]
    .map((m) => m[1])
    .filter((name) => !new RegExp(`@main\\s+(?:public\\s+|final\\s+)*(?:struct|enum|class)\\s+${name}\\b`).test(text));
  for (const name of declared) {
    const hits = swift.reduce((n, f) => n + (read(f).match(new RegExp(`\\b${name}\\b`, "g")) || []).length, 0);
    if (hits <= 1) report("dead code", rel(file), `${name} is declared and never used`);
  }
}

// --------------------------------------------------------------- duplication
// Eight identical lines in two places is a function waiting to be extracted.
const WINDOW = 8;
const seen = new Map();
for (const file of sources) {
  const lines = read(file)
    .split("\n")
    .map((l, i) => ({ i: i + 1, t: l.trim() }))
    .filter((l) => l.t && !l.t.startsWith("//") && !l.t.startsWith("*") && !l.t.startsWith("/*"));
  for (let i = 0; i + WINDOW <= lines.length; i++) {
    const key = lines.slice(i, i + WINDOW).map((l) => l.t).join("\n");
    if (key.length < 120) continue;
    const at = `${rel(file)}:${lines[i].i}`;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(at);
  }
}
const dupes = new Set();
for (const places of seen.values()) {
  if (places.length < 2) continue;
  const label = places.join(" and ");
  if (dupes.has(label)) continue;
  dupes.add(label);
  report("duplication", places[0], `${WINDOW} identical lines also at ${places.slice(1).join(", ")}`);
}

// ------------------------------------------------------------------- naming
for (const file of jsAll) {
  const name = basename(file, extname(file));
  if (!/^[a-z][a-z0-9.-]*$/.test(name)) report("naming", rel(file), "javascript file names are lower case with hyphens");
}
for (const file of js) {
  for (const [, name] of read(file).matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)) {
    if (!/^[a-z][A-Za-z0-9]*$/.test(name)) report("naming", rel(file), `function ${name} is not camelCase`);
  }
  for (const [, name] of read(file).matchAll(/^export\s+class\s+([A-Za-z_$][\w$]*)/gm)) {
    if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) report("naming", rel(file), `class ${name} is not UpperCamelCase`);
  }
}
for (const file of swift) {
  // Swift convention: Type.swift declares Type, Type+Feature.swift extends it.
  const name = basename(file, ".swift").split("+")[0];
  const text = read(file);
  if (!new RegExp(`(struct|enum|actor|class|extension)\\s+${name}\\b`).test(text)) {
    report("naming", rel(file), `no type called ${name}; a Swift file is named after what it declares`);
  }
}

// ------------------------------------------------------- one job per file
for (const file of sources) {
  const lines = read(file).split("\n").length;
  if (lines > MAX_LINES) report("responsibility", rel(file), `${lines} lines; split it`);
}

// ----------------------------------------------------------------- comments
for (const file of sources) {
  read(file).split("\n").forEach((line, i) => {
    const t = line.trim();
    const isComment = /^(\/\/|#|\*)/.test(t);
    const isDoc = /^(\/\/\/|\/\*\*|\*)/.test(t);
    if (isComment && /\b(TODO|FIXME|XXX|HACK)\b/.test(t)) report("comment", `${rel(file)}:${i + 1}`, "leftover marker");
    // A commented-out statement is code no one is maintaining.
    if (!isDoc && /^\/\/\s*\S/.test(t) && /[;{}]\s*$/.test(t) && !/^\/\/\s*[A-Z]/.test(t)) {
      report("comment", `${rel(file)}:${i + 1}`, "commented-out code");
    }
  });
}

// --------------------------------------------------------------------- docs
const docText = docs.map((d) => ({ file: d, text: read(d) }));
for (const { file, text } of docText) {
  // Every repo path a document names has to exist.
  for (const [, path] of text.matchAll(/`((?:app|proxy|docs|scripts|\.github|src|test|assets|deploy)\/[\w./-]+)`/g)) {
    // A path is read from the repository root or from the document's own folder.
    if (!existsSync(join(ROOT, path)) && !existsSync(join(dirname(file), path))) {
      report("docs", rel(file), `names ${path}, which does not exist`);
    }
  }
}
// Every route the server answers has to be written down, and the other way round.
const serverText = read(join(ROOT, "proxy/src/server.js"));
// Routes are written both as plain strings and as regular expressions.
const routes = new Set([
  ...[...serverText.matchAll(/["'`](\/v1\/[\w/-]*)/g)].map((m) => m[1]),
  ...[...serverText.matchAll(/\/\^\\\/v1\\\/([\w-]+)/g)].map((m) => `/v1/${m[1]}`),
].map((r) => r.replace(/\/$/, "")));
const proxyDoc = read(join(ROOT, "proxy/README.md"));
for (const route of routes) {
  const stem = route.split("/").slice(0, 3).join("/");
  if (!proxyDoc.includes(stem)) report("docs", "proxy/README.md", `${stem} is served but not documented`);
}
for (const [, route] of proxyDoc.matchAll(/`GET (\/v1\/[\w/{}.-]+)/g)) {
  const stem = route.split("/").slice(0, 3).join("/");
  if (![...routes].some((r) => r.startsWith(stem))) report("docs", "proxy/README.md", `documents ${stem}, which the server no longer serves`);
}

// ----------------------------------------------------------------- secrets
// The rule: a key reaches the proxy through config.js and never reaches the
// app at all. Anything else is a leak waiting to be committed.
const TEXT = new Set([".js", ".mjs", ".swift", ".md", ".yml", ".yaml", ".json", ".sh", ".py", ".plist"]);
const SECRET_SHAPES = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "a private key"],
  [/\bsk_live_[A-Za-z0-9]{16,}/, "a live provider key"],
  [/\bghp_[A-Za-z0-9]{20,}/, "a GitHub token"],
  [/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./, "a signed token"],
];
for (const file of files) {
  if (!TEXT.has(extname(file)) || rel(file) === "scripts/audit.mjs") continue;
  const text = read(file);
  for (const [shape, what] of SECRET_SHAPES) {
    if (shape.test(text)) report("secrets", rel(file), `contains ${what}`);
  }
  // A literal assigned to something called a key, secret or token.
  for (const [, name, value] of text.matchAll(/\b([A-Za-z_]*(?:key|secret|token|password)[A-Za-z_]*)\s*[:=]\s*["'`]([^"'`\n]{20,})["'`]/gi)) {
    // A real credential is long and has digits in it; a settings name does not.
    if (!/\d/.test(value) || /^\$\{|^process\.env|^env\.|^https?:/.test(value)) continue;
    report("secrets", rel(file), `${name} is assigned a literal`);
  }
}
const CONFIG = "proxy/src/config.js";
for (const file of jsAll) {
  if (rel(file) === CONFIG) continue;
  const text = read(file);
  for (const [, name] of text.matchAll(/process\.env\.([A-Z_]*(?:KEY|SECRET|TOKEN|PASSWORD)[A-Z_]*)/g)) {
    report("secrets", rel(file), `reads ${name} directly; credentials come from ${CONFIG}`);
  }
  if (/readFileSync\([^)]*\.key/.test(text)) report("secrets", rel(file), `reads a key file directly; that belongs in ${CONFIG}`);
}
for (const file of [...swift, ...files.filter((f) => rel(f).startsWith("app/") && TEXT.has(extname(f)))]) {
  const text = read(file);
  if (/(apiKey|api_key|x-apisports-key|authorization:\s*["'`]Bearer)/i.test(text)) {
    report("secrets", rel(file), "the app talks to a provider; it may only talk to the proxy");
  }
}

// ----------------------------------------------------------------- coverage
let coverage = null;
try {
  const { execFileSync } = await import("node:child_process");
  const suite = readdirSync(join(ROOT, "proxy/test")).filter((f) => f.endsWith(".test.js")).map((f) => `test/${f}`);
  const out = execFileSync("node", ["--test", "--experimental-test-coverage", ...suite], {
    cwd: join(ROOT, "proxy"), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  });
  const line = out.split("\n").find((l) => l.includes("all files"));
  coverage = line ? Number(line.split("|")[1]?.trim()) : null;
  if (coverage !== null && coverage < COVERAGE_FLOOR) {
    report("tests", "proxy", `line coverage ${coverage}%, floor is ${COVERAGE_FLOOR}%`);
  }
} catch (err) {
  report("tests", "proxy", `the suite did not pass: ${String(err.stdout || err.message).split("\n").filter((l) => l.startsWith("not ok")).slice(0, 3).join("; ") || "see npm test"}`);
}

// ------------------------------------------------------------------- output
const quiet = process.argv.includes("--quiet");
if (!quiet) {
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
console.log(`\n${findings.length} finding${findings.length === 1 ? "" : "s"}${coverage === null ? "" : `, coverage ${coverage}%`}`);
process.exit(findings.length ? 1 : 0);
