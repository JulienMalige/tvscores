import { extname } from "node:path";

// The rule: a key reaches the proxy through config.js and never reaches the
// app at all. Anything else is a leak waiting to be committed.
const CONFIG = "proxy/src/config.js";
const TEXT = new Set([".js", ".mjs", ".swift", ".md", ".yml", ".yaml", ".json", ".sh", ".py", ".plist"]);
const SHAPES = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "a private key"],
  [/\bsk_live_[A-Za-z0-9]{16,}/, "a live provider key"],
  [/\bghp_[A-Za-z0-9]{20,}/, "a GitHub token"],
  [/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./, "a signed token"],
];

function committed({ files, rel, read }, report) {
  for (const file of files) {
    if (!TEXT.has(extname(file)) || rel(file).startsWith("scripts/audit")) continue;
    const text = read(file);
    for (const [shape, what] of SHAPES) {
      if (shape.test(text)) report("secrets", rel(file), `contains ${what}`);
    }
    for (const [, name, value] of text.matchAll(/\b([A-Za-z_]*(?:key|secret|token|password)[A-Za-z_]*)\s*[:=]\s*["'`]([^"'`\n]{20,})["'`]/gi)) {
      // A real credential is long and has digits in it; a settings name does not.
      if (!/\d/.test(value) || /^\$\{|^process\.env|^env\.|^https?:/.test(value)) continue;
      report("secrets", rel(file), `${name} is assigned a literal`);
    }
  }
}

function throughConfig({ jsAll, rel, read }, report) {
  for (const file of jsAll) {
    if (rel(file) === CONFIG) continue;
    const text = read(file);
    for (const [, name] of text.matchAll(/process\.env\.([A-Z_]*(?:KEY|SECRET|TOKEN|PASSWORD)[A-Z_]*)/g)) {
      report("secrets", rel(file), `reads ${name} directly; credentials come from ${CONFIG}`);
    }
    if (/readFileSync\([^)]*\.key/.test(text)) report("secrets", rel(file), `reads a key file directly; that belongs in ${CONFIG}`);
  }
}

function appTalksOnlyToTheProxy({ files, rel, read }, report) {
  for (const file of files) {
    if (!rel(file).startsWith("app/") || !TEXT.has(extname(file))) continue;
    if (/(apiKey|api_key|x-apisports-key|authorization:\s*["'`]Bearer)/i.test(read(file))) {
      report("secrets", rel(file), "the app talks to a provider; it may only talk to the proxy");
    }
  }
}

export const checks = [committed, throughConfig, appTalksOnlyToTheProxy];
