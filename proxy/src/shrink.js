import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("../scripts/shrink.py", import.meta.url));

/**
 * A crest or portrait brought down to what the television draws: at most 256 px,
 * as WebP (scripts/shrink.py, Pillow). Resolves to the new bytes, or null when
 * the picture is to be kept as it came: already small, not decodable, or no
 * Python here. The mirror then serves the original, so a missing helper costs
 * bytes and nothing else.
 */
export function shrinkImage(buffer, { timeoutMs = 10000, python = "python3" } = {}) {
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
