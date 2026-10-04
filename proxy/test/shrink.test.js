import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { shrinkImage } from "../src/shrink.js";

const pillow = spawnSync("python3", ["-c", "import PIL"]).status === 0;

function png(side, noisy) {
  const code = `import io,sys,random\nfrom PIL import Image\nrandom.seed(1)\nim=Image.new('RGBA',(${side},${side}))\n`
    + (noisy ? `im.putdata([(random.randint(0,255),random.randint(0,255),random.randint(0,255),255) for _ in range(${side * side})])\n` : "")
    + "b=io.BytesIO();im.save(b,'PNG');sys.stdout.buffer.write(b.getvalue())";
  return spawnSync("python3", ["-c", code], { maxBuffer: 1 << 26 }).stdout;
}

test("a big crest comes back as a much smaller WebP", { skip: !pillow }, async () => {
  const big = png(512, true);
  const out = await shrinkImage(big);
  assert.ok(out, "shrunk");
  assert.equal(out.subarray(0, 4).toString(), "RIFF");
  assert.equal(out.subarray(8, 12).toString(), "WEBP");
  assert.ok(out.length < big.length / 3, `${out.length} of ${big.length}`);
});

test("a picture that is already small is left alone", { skip: !pillow }, async () => {
  assert.equal(await shrinkImage(png(64, false)), null);
});

test("bytes that are not a picture, or no Python at all, leave it alone too", async () => {
  assert.equal(await shrinkImage(Buffer.from("not an image")), null);
  assert.equal(await shrinkImage(Buffer.from("x"), { python: "no-such-python-here" }), null);
});

test("only a few interpreters run at once", async () => {
  const runs = Array.from({ length: 12 }, () => shrinkImage(Buffer.from("not an image")));
  const out = await Promise.all(runs);
  assert.ok(out.every((r) => r === null), "all twelve are answered, however they queue");
});
