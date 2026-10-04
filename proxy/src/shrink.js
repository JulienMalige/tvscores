import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

/** Interpreters running at once: a table of forty cold crests is not forty of them. */
const MAX_RUNNING = 4;
let running = 0;
const waiting = [];
const slot = () => new Promise((go) => (running < MAX_RUNNING ? (running++, go()) : waiting.push(go)));
const release = () => (waiting.length ? waiting.shift()() : running--);

const SCRIPT = fileURLToPath(new URL("../scripts/shrink.py", import.meta.url));

/**
 * A crest or portrait brought down to what the television draws: at most 256 px,
 * as WebP (scripts/shrink.py, Pillow). Resolves to the new bytes, or null when
 * the picture is to be kept as it came: already small, not decodable, or no
 * Python here. The mirror then serves the original, so a missing helper costs
 * bytes and nothing else.
 */
export async function shrinkImage(buffer, opts) {
  await slot();
  try {
    return await run(buffer, opts);
  } finally {
    release();
  }
}

function run(buffer, { timeoutMs = 10000, python = "python3" } = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(python, [SCRIPT], { stdio: ["pipe", "pipe", "ignore"] });
    } catch {
      return resolve(null);
    }
    const chunks = [];
    const timer = setTimeout(() => { child.kill(); resolve(null); }, timeoutMs);
    child.on("error", () => { clearTimeout(timer); resolve(null); });
    child.stdout.on("data", (c) => chunks.push(c));
    child.on("close", (code) => {
      clearTimeout(timer);
      const out = Buffer.concat(chunks);
      resolve(code === 0 && out.length && out.length < buffer.length ? out : null);
    });
    child.stdin.on("error", () => {});
    child.stdin.end(buffer);
  });
}
