/**
 * League tables as Wikipedia's source writes them, read back as numbers:
 * English Wikipedia's rugby tables (`{{#invoke:Sports table|main|style=Rugby}}`)
 * and French Wikipedia's (a `{{Classement début Rugby}}` heading over one
 * `{{Cls Rugby}}` line per club). Points are counted the way each template
 * counts them, so that a table reads here as it reads there.
 */

/** Comments and references hold pipes and braces of their own, and nothing a table needs. */
const clean = (text) => String(text)
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/<ref[^>]*\/>/gi, "")
  .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "");

/** A template's name as MediaWiki compares them: case, underscores and spacing aside. */
const canonical = (name) => name.replace(/_/g, " ").replace(/\s*:\s*/g, ":").replace(/\s+/g, " ").trim().toLowerCase();

/** A number as a table writes it; nothing, or anything else, is `fallback`. */
function num(value, fallback = 0) {
  const text = String(value ?? "").trim().replace(/−/g, "-");
  if (!text) return fallback;
  const n = Number(text);
  return Number.isFinite(n) ? n : fallback;
}

/** Where the template call opening at `start` closes: the index of its "}}", or -1. */
function closing(text, start) {
  let depth = 0;
  for (let i = start; i < text.length - 1; i++) {
    if (text[i] === "{" && text[i + 1] === "{") { depth += 1; i += 1; }
    else if (text[i] === "}" && text[i + 1] === "}") { depth -= 1; i += 1; if (!depth) return i - 1; }
  }
  return -1;
}

/** The template calls of `text` that sit inside no other, in page order, each as what its braces hold. */
export function calls(text) {
  const out = [];
  let i = text.indexOf("{{");
  while (i !== -1) {
    const end = closing(text, i);
    // A brace left open is a typo on the page: stepped over, not the end of the page.
    if (end < 0) { i = text.indexOf("{{", i + 2); continue; }
    out.push(text.slice(i + 2, end));
    i = text.indexOf("{{", end + 2);
  }
  return out;
}

/**
 * A call's name and arguments, `{ name, args }`: the named ones by name and
 * the others numbered from 1, split on this call's own pipes only, not on
 * those of a template or a link inside it.
 */
export function parts(inside) {
  const pieces = [];
  let depth = 0, from = 0;
  for (let i = 0; i < inside.length; i++) {
    const two = inside.slice(i, i + 2);
    if (two === "{{" || two === "[[") { depth += 1; i += 1; }
    else if (two === "}}" || two === "]]") { depth -= 1; i += 1; }
    else if (inside[i] === "|" && depth === 0) { pieces.push(inside.slice(from, i)); from = i + 1; }
  }
  pieces.push(inside.slice(from));
  const args = {};
  let n = 0;
  for (const piece of pieces.slice(1)) {
    const named = /^\s*([^=[{]+?)\s*=([\s\S]*)$/.exec(piece);
    if (named) args[named[1]] = named[2].trim();
    else args[++n] = piece.trim();
  }
  return { name: canonical(pieces[0]), args };
}

/**
 * One Sports table: its sides in the order it lists them (`team_order`, or
 * `team1`, `team2`...: the editors keep it ranked), with what the module
 * counts points from — 4 a win, 2 a draw and none a defeat unless
 * `winpoints`, `drawpoints` or `losspoints` say otherwise, the bonuses
 * (`tb_`, `lb_`, `gs_`, `b_`), and any `adjust_points_` or `startpoints_`.
 */
function sportsTable(args) {
  const order = args.team_order
    ? args.team_order.split(",")
    : Object.keys(args).filter((k) => /^team\d+$/.test(k)).sort((a, b) => num(a.slice(4)) - num(b.slice(4))).map((k) => args[k]);
  const per = { win: num(args.winpoints, 4), draw: num(args.drawpoints, 2), loss: num(args.losspoints, 0) };
  return order.map((code) => code.trim()).filter(Boolean).map((code) => {
    const n = (field) => num(args[`${field}_${code}`]);
    const [w, d, l] = [n("win"), n("draw"), n("loss")];
    const bonus = n("tb") + n("lb") + n("gs") + n("b");
    const pts = per.win * w + per.draw * d + per.loss * l + bonus + n("adjust_points") + n("startpoints");
    return { name: args[`name_${code}`] || code, w, d, l, pf: n("pf"), pa: n("pa"), bonus, pts };
  });
}

/**
 * One `{{Cls Rugby}}` line: won, drawn, lost (`v`, `n`, `d`), the bonuses
 * (`bo`, `bd`, `bon`), points for and against (`pp`, `pc`), a penalty
 * (`pén`), and `pts` where the editors set the total themselves — else 4 a
 * win and 2 a draw, as the template counts. The club is a key of
 * `{{chemin équipes rugby à XV}}`, a country one of `{{<pays> rugby}}`.
 */
function clsLine(args) {
  const n = (field) => num(args[field]);
  const [w, d, l] = [n("v"), n("n"), n("d")];
  const bonus = n("bo") + n("bd") + n("bon");
  const name = args.club ? `{{chemin équipes rugby à XV|${args.club}}}`
    : args.pays ? `{{${args.pays} rugby}}`
      : args.equipe || (args.nc ? `[[${args.nc}|${args.ns || args.nc}]]` : "");
  return { name, w, d, l, pf: n("pp"), pa: n("pc"), bonus, pts: args.pts ? n("pts") : 4 * w + 2 * d + bonus - n("pén") };
}

/**
 * Every rugby table on a page, in page order: `[{ rows }]`, a row being
 * `{ name, w, d, l, pf, pa, bonus, pts }` with the side's name still as the
 * source writes it, templates and all.
 */
export function tablesIn(source) {
  const tables = [];
  for (const inside of calls(clean(source))) {
    const { name, args } = parts(inside);
    if (name === "#invoke:sports table" && String(args.style).toLowerCase() === "rugby") tables.push({ rows: sportsTable(args) });
    else if (name === "classement début rugby") tables.push({ rows: [] });
    else if (name === "cls rugby" && tables.length) tables.at(-1).rows.push(clsLine(args));
  }
  return tables.filter((t) => t.rows.length);
}

/**
 * The side a name shows, from its expanded source: the link's target and
 * its words (`[[Section paloise (rugby à XV)|Section paloise]]`), past the
 * flags and the markup around them; the plain words when there is no link.
 */
export function linkOf(source) {
  const text = String(source)
    .replace(/\[\[(?:file|image|fichier):[^\]]*\]\]/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ");
  const link = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/.exec(text);
  if (link) return { target: link[1].trim(), label: (link[2] ?? link[1]).replace(/'{2,}/g, "").trim() };
  return { label: text.replace(/\{\{[^{}]*\}\}/g, "").replace(/'{2,}/g, "").trim() };
}
