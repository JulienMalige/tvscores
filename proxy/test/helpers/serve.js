import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../../src/cache.js";
import { createApp } from "../../src/server.js";
import { config } from "../../src/config.js";

/** Starts the app on an ephemeral port and returns a fetch bound to it. */
export async function serve(extra = {}) {
  const store = new Store(mkdtempSync(join(tmpdir(), "tvscores-")));
  const app = createApp({ store, config, ...extra });
  await new Promise((done) => app.listen(0, "127.0.0.1", done));
  const { port } = app.address();
  return {
    store,
    port,
    get: (path, headers) => fetch(`http://127.0.0.1:${port}${config.pathPrefix}${path}`, { headers }),
    close: () => new Promise((done) => app.close(done)),
  };
}

/** A raw request, for the shapes fetch will not send. */
export async function raw(port, request) {
  const net = await import("node:net");
  return new Promise((resolve) => {
    const sock = net.connect(port, "127.0.0.1", () => sock.write(request));
    let out = "";
    sock.on("data", (d) => (out += d));
    sock.on("close", () => resolve(out));
    sock.on("error", () => resolve(out));
    setTimeout(() => { sock.destroy(); resolve(out); }, 1500);
  });
}
