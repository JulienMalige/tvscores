import { getJson } from "../http.js";

/** Shared API-Sports client: one key, one header, quota-aware. */
export class ApiSports {
  constructor({ key, quota, log = () => {} }) {
    this.key = key;
    this.quota = quota;
    this.log = log;
  }

  async get(base, path, params = {}) {
    if (!this.key) throw new Error("API-Sports key missing");
    const qs = new URLSearchParams(params).toString();
    const url = `${base}${path}${qs ? "?" + qs : ""}`;
    const { body, remaining } = await getJson(url, { headers: { "x-apisports-key": this.key } });
    this.quota.record(remaining);
    const errors = body.errors;
    if (errors && (Array.isArray(errors) ? errors.length : Object.keys(errors).length)) {
      throw new Error(`API-Sports ${path}: ${JSON.stringify(errors)}`);
    }
    this.log(`GET ${url} -> ${body.results} results, ${remaining ?? "?"} calls left`);
    return body.response || [];
  }
}

/**
 * Every API-Sports sport is fetched the same way: one call for a date, one for
 * whatever is live. Only the endpoint and how rows are kept differ.
 */
export function dailyAndLive({ sport, client, base, path, keep }) {
  return {
    sport,
    async byDate(date) {
      return keep(await client.get(base, path, { date }));
    },
    async live() {
      return keep(await client.get(base, path, { live: "all" }));
    },
  };
}
