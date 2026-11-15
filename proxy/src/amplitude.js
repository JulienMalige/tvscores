import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Amplitude's own count of the viewers who said yes, for the audience page
 * to set beside the server's (Julien, 2026-11-15: "Try to cross with
 * amplitude"; docs/analytics.md). Totals only, never device by device: the
 * server keeps nothing to match a device with. Read from Amplitude's
 * Dashboard REST API with the project's key and secret key, asked when the
 * page is opened and kept ten minutes, so nothing polls.
 */
const API = "https://amplitude.com/api/2/users";
const TTL = 10 * 60e3;
const ymd = (t) => new Date(t).toISOString().slice(0, 10).replaceAll("-", "");

/** The key and secret from ~/.config/tvscores, or nothing when either is missing. */
export function amplitudeCredentials(dir = join(homedir(), ".config/tvscores")) {
  try {
    const read = (name) => readFileSync(join(dir, name), "utf8").trim();
    return { key: read("amplitude.key"), secret: read("amplitude.secret") };
  } catch {
    return null;
  }
}

/** Active users a day over 30 days, and by country over the last 7: what the page shows. */
export function amplitudeReader({ key, secret, fetch = globalThis.fetch, now = Date.now }) {
  const auth = `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`;
  let held;
  const get = async (start, end, extra = "") => {
    const res = await fetch(`${API}?start=${start}&end=${end}&m=active&i=1${extra}`, { headers: { authorization: auth }, signal: AbortSignal.timeout(10e3) });
    if (!res.ok) throw new Error(`amplitude answered ${res.status}`);
    return (await res.json()).data;
  };
  return async function summary() {
    if (held && now() - held.at < TTL) return held.value;
    const end = ymd(now());
    const [month, week] = await Promise.all([get(ymd(now() - 29 * 864e5), end), get(ymd(now() - 6 * 864e5), end, "&g=country")]);
    const days = Object.fromEntries(month.xValues.map((day, i) => [day, month.series[0][i] ?? 0]));
    const countries = Object.fromEntries(week.seriesLabels.map((label, i) => [String(label), week.series[i].reduce((a, b) => a + b, 0)]));
    held = { at: now(), value: { days, countries } };
    return held.value;
  };
}
