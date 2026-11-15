import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

/**
 * Apple's count of downloads, the only source that sees installs, for the
 * audience page (Julien, 2026-11-15: "how many people have installed the
 * app"; docs/analytics.md). Apple's daily "App Downloads Standard" report of
 * the ongoing analytics request (docs/release.md), read with the Admin key
 * when the page opens. A day's report never changes once out, so each is
 * fetched once and kept in `<dir>/apple-downloads.json`.
 */
const REQUEST = "2d5f6086-cc3f-4e67-bf83-5316fdbe2f70";
const REPORT = "App Downloads Standard";
const TTL = 6 * 3600e3;

/** The rows of one report file: tab-separated, a header line first. */
export function parseDownloads(tsv) {
  const [head, ...lines] = tsv.trim().split("\n");
  const cols = head.split("\t");
  const at = (name) => cols.indexOf(name);
  const [date, type, device, territory, counts] = ["Date", "Download Type", "Device", "Territory", "Counts"].map(at);
  return lines.filter(Boolean).map((line) => {
    const f = line.split("\t");
    return { date: f[date], type: f[type], device: f[device], territory: f[territory], count: Number(f[counts]) || 0 };
  });
}

/**
 * `asc` is scripts/asc.mjs's client; it reads its credentials from ASC_ENV,
 * which points at the Admin key here: an App Manager key cannot read reports.
 */
export function appleDownloads({ dir, asc, now = Date.now, log = () => {} }) {
  const file = join(dir, "apple-downloads.json");
  let kept;
  try {
    kept = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    kept = { instances: {} };
  }
  let checkedAt = 0;
  return async function rows() {
    if (now() - checkedAt > TTL) {
      checkedAt = now();
      try {
        const reports = await asc(`/v1/analyticsReportRequests/${REQUEST}/reports?filter[name]=${encodeURIComponent(REPORT)}`);
        const report = reports.data.find((r) => r.attributes.name === REPORT);
        const instances = await asc(`/v1/analyticsReports/${report.id}/instances?filter[granularity]=DAILY&limit=200`);
        for (const instance of instances.data) {
          if (kept.instances[instance.id]) continue;
          const segments = await asc(`/v1/analyticsReportInstances/${instance.id}/segments`);
          const parts = [];
          for (const segment of segments.data) {
            const res = await fetch(segment.attributes.url, { signal: AbortSignal.timeout(20e3) });
            if (!res.ok) throw new Error(`report segment answered ${res.status}`);
            parts.push(...parseDownloads(gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8")));
          }
          kept.instances[instance.id] = parts;
        }
        mkdirSync(dir, { recursive: true });
        writeFileSync(file, JSON.stringify(kept));
      } catch (err) {
        log(`apple downloads: ${err.message.split("\n")[0]}`);
      }
    }
    return Object.values(kept.instances).flat();
  };
}

/** Where scripts/asc.mjs finds the Admin key, unless the service says otherwise. */
export const ADMIN_ENV = join(homedir(), ".config/secrets/asc-admin.env");
