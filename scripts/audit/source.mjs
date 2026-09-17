import { basename, extname } from "node:path";

const WINDOW = 8;
const MAX_LINES = 260;

/** Exports and modules nothing names, and Swift types declared once. */
function deadCode({ js, jsAll, swift, sources, rel, read }, report) {
  for (const file of js) {
    const text = read(file);
    const exported = [...text.matchAll(/^export\s+(?:async\s+)?(?:function|class|const|let)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
    for (const name of exported) {
      const used = sources.some((other) => other !== file && new RegExp(`\\b${name}\\b`).test(read(other)));
      if (!used) report("dead code", rel(file), `exports ${name}, nothing imports it`);
    }
  }
  const ENTRY = new Set(["proxy/src/index.js"]);
  for (const file of js) {
    if (ENTRY.has(rel(file))) continue;
    const name = basename(file);
    const imported = jsAll.some((other) => other !== file && read(other).includes(`/${name}"`));
    if (!imported) report("dead code", rel(file), "no module imports this file");
  }
  // A test suite is found by the runner, never named by our code: it is an
  // entry point, like @main, and it lives under app/Tests to say so.
  for (const file of swift.filter((f) => !rel(f).startsWith("app/Tests/"))) {
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
}

/** Eight identical lines in two places is a function waiting to be extracted. */
function duplication({ sources, rel, read }, report) {
  const seen = new Map();
  for (const file of sources) {
    const lines = read(file)
      .split("\n")
      .map((l, i) => ({ i: i + 1, t: l.trim() }))
      .filter((l) => l.t && !l.t.startsWith("//") && !l.t.startsWith("*") && !l.t.startsWith("/*"));
    for (let i = 0; i + WINDOW <= lines.length; i++) {
      const key = lines.slice(i, i + WINDOW).map((l) => l.t).join("\n");
      if (key.length < 120) continue;
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key).push(`${rel(file)}:${lines[i].i}`);
    }
  }
  const said = new Set();
  for (const places of seen.values()) {
    if (places.length < 2) continue;
    const label = places.join(" and ");
    if (said.has(label)) continue;
    said.add(label);
    report("duplication", places[0], `${WINDOW} identical lines also at ${places.slice(1).join(", ")}`);
  }
}

function naming({ js, jsAll, swift, rel, read }, report) {
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
    if (!new RegExp(`(struct|enum|actor|class|extension)\\s+${name}\\b`).test(read(file))) {
      report("naming", rel(file), `no type called ${name}; a Swift file is named after what it declares`);
    }
  }
}

function size({ sources, rel, read }, report) {
  for (const file of sources) {
    const lines = read(file).split("\n").length;
    if (lines > MAX_LINES) report("responsibility", rel(file), `${lines} lines; split it`);
  }
}

function comments({ sources, rel, read }, report) {
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
}

export const checks = [deadCode, duplication, naming, size, comments];
