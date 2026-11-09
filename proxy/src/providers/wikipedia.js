import { getJson } from "../http.js";

/**
 * Wikipedia's documented API, the MediaWiki Action API (`/w/api.php`), read
 * the way its etiquette asks: a User-Agent saying who asks and where to find
 * them, one request at a time, and `maxlag` so that a busy cluster turns us
 * away first. Page source only, never the rendered pages; the terms are in
 * docs/data-providers.md.
 */
const USER_AGENT = "TVScores/1.1 (https://tvscores.julienmalige.com/; league tables for an Apple TV app)";
/** Between the names sent to be expanded together: plain text, which no template touches. */
const SEPARATOR = "@@TVSCORES@@";
/** Names per expansion, to keep the address of a request short. */
const NAMES_PER_CALL = 20;

export const articleUrl = (lang, title) => `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

export function wikipedia({ get = getJson } = {}) {
  async function api(lang, params) {
    const query = new URLSearchParams({ ...params, format: "json", formatversion: "2", maxlag: "5" });
    const { body } = await get(`https://${lang}.wikipedia.org/w/api.php?${query}`, { headers: { "user-agent": USER_AGENT } });
    if (body?.error) throw new Error(`Wikipedia ${lang}: ${body.error.code}`);
    return body;
  }

  /**
   * The source of each page, under the title it was asked by, in one
   * request: `{ title, content }`, with the title it has once a redirect is
   * followed. A page that does not exist is left out.
   */
  async function pages(lang, titles) {
    const body = await api(lang, { action: "query", prop: "revisions", rvprop: "content", rvslots: "main", redirects: "1", titles: titles.join("|") });
    const q = body?.query || {};
    const step = (list, title) => list?.find((x) => x.from === title)?.to ?? title;
    const out = new Map();
    for (const asked of titles) {
      const title = step(q.redirects, step(q.normalized, asked));
      const content = q.pages?.find((p) => p.title === title)?.revisions?.[0]?.slots?.main?.content;
      if (typeof content === "string") out.set(asked, { title, content });
    }
    return out;
  }

  /** Each piece of source as the page `title` would show it, templates expanded, one answer per piece. */
  async function expand(lang, title, pieces) {
    const out = [];
    for (let i = 0; i < pieces.length; i += NAMES_PER_CALL) {
      const chunk = pieces.slice(i, i + NAMES_PER_CALL);
      const body = await api(lang, { action: "expandtemplates", prop: "wikitext", title, text: chunk.join(`\n${SEPARATOR}\n`) });
      const parts = String(body?.expandtemplates?.wikitext ?? "").split(SEPARATOR).map((s) => s.trim());
      if (parts.length !== chunk.length) throw new Error(`Wikipedia ${lang}: ${parts.length} names back for ${chunk.length}`);
      out.push(...parts);
    }
    return out;
  }

  return { pages, expand };
}
