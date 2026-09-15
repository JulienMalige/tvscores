import { readdirSync } from "node:fs";
import { join } from "node:path";

const FLOOR = 70;

/** The repository's own tooling is tested too, without a coverage floor. */
function tooling({ root, run }, report) {
  // Named files, not the directory: `node --test <dir>` does not pick them up.
  const suite = readdirSync(join(root, "scripts/test")).filter((f) => f.endsWith(".test.mjs")).map((f) => `scripts/test/${f}`);
  if (!suite.length) return report("tests", "scripts", "no tests for the repository's own tooling");
  try {
    run("node", ["--test", ...suite], root);
  } catch (err) {
    const failures = String(err.stdout || err.message).split("\n").filter((l) => l.startsWith("not ok")).slice(0, 3).join("; ");
    report("tests", "scripts", `the tooling tests did not pass: ${failures || `see node --test ${suite.join(" ")}`}`);
  }
}

/** The suite has to pass, and cover enough of the proxy to mean something. */
function coverage({ root, run }, report, state) {
  const suite = readdirSync(join(root, "proxy/test")).filter((f) => f.endsWith(".test.js")).map((f) => `test/${f}`);
  try {
    const out = run("node", ["--test", "--experimental-test-coverage", ...suite], join(root, "proxy"));
    const line = out.split("\n").find((l) => l.includes("all files"));
    state.coverage = line ? Number(line.split("|")[1]?.trim()) : null;
    if (state.coverage !== null && state.coverage < FLOOR) {
      report("tests", "proxy", `line coverage ${state.coverage}%, floor is ${FLOOR}%`);
    }
  } catch (err) {
    const failures = String(err.stdout || err.message).split("\n").filter((l) => l.startsWith("not ok")).slice(0, 3).join("; ");
    report("tests", "proxy", `the suite did not pass: ${failures || "see npm test"}`);
  }
}

export const checks = [coverage, tooling];
