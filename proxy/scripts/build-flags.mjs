// Flat square flags for the television, from the flag-icons set (MIT,
// https://github.com/lipis/flag-icons): its 1x1 SVGs rasterised to 160 px
// PNGs under assets/flags/<iso2>.png. The app clips them to a circle, the
// way Apple Sports draws a race's country. Run by hand when the set moves:
//
//   npm pack flag-icons && tar xzf flag-icons-*.tgz package/flags/1x1
//   npm install @resvg/resvg-js            # in a scratch directory
//   NODE_PATH=<scratch>/node_modules node scripts/build-flags.mjs package/flags/1x1
//
// Only ISO 3166-1 alpha-2 codes are kept; the set's subdivisions (gb-eng,
// es-ct...) are not what a nationality resolves to.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Resvg } = require("@resvg/resvg-js");

const src = process.argv[2];
if (!src) throw new Error("usage: build-flags.mjs <flag-icons/flags/1x1>");
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "flags");
mkdirSync(out, { recursive: true });
let n = 0;
for (const file of readdirSync(src)) {
  const m = file.match(/^([a-z]{2})\.svg$/);
  if (!m) continue;
  const png = new Resvg(readFileSync(join(src, file), "utf8"), { fitTo: { mode: "width", value: 160 } }).render().asPng();
  writeFileSync(join(out, `${m[1]}.png`), png);
  n++;
}
console.log(`${n} flags -> ${out}`);
