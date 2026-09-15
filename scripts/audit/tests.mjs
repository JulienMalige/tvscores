import { readdirSync } from "node:fs";
import { join } from "node:path";

const FLOOR = 70;

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

export const checks = [coverage];
