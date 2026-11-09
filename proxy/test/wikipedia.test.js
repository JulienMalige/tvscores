import test from "node:test";
import assert from "node:assert/strict";
import { articleUrl, wikipedia } from "../src/providers/wikipedia.js";

/** Wikipedia's API answering by what it is asked; every request kept, address and headers. */
function api(answer) {
  const asked = [];
  const get = async (url, { headers }) => {
    const parsed = new URL(url);
    asked.push({ url: parsed, headers });
    return { body: answer(parsed.searchParams) };
  };
  return { asked, wiki: wikipedia({ get }) };
}

const page = (title, content) => ({ title, revisions: [{ slots: { main: { content } } }] });

test("each page comes back under the title it was asked by, past a redirect; a missing one is left out", async () => {
  const { asked, wiki } = api(() => ({ query: {
    normalized: [{ from: "2027_Six_Nations_Championship", to: "2027 Six Nations Championship" }],
    redirects: [{ from: "2027 Men's Rugby World Cup", to: "2027 Rugby World Cup" }],
    pages: [page("2027 Six Nations Championship", "six"), page("2027 Rugby World Cup", "rwc"), { title: "Nowhere", missing: true }],
  } }));
  const got = await wiki.pages("en", ["2027_Six_Nations_Championship", "2027 Men's Rugby World Cup", "Nowhere"]);
  assert.deepEqual([...got], [
    ["2027_Six_Nations_Championship", { title: "2027 Six Nations Championship", content: "six" }],
    ["2027 Men's Rugby World Cup", { title: "2027 Rugby World Cup", content: "rwc" }],
  ]);
  assert.equal(asked.length, 1, "every page in one request");
  const [{ url, headers }] = asked;
  assert.equal(url.origin, "https://en.wikipedia.org");
  assert.equal(url.pathname, "/w/api.php", "the documented API, not the pages people read");
  assert.equal(url.searchParams.get("maxlag"), "5", "a busy Wikipedia turns us away first");
  assert.match(headers["user-agent"], /^TVScores\/\S+ \(https:\/\/tvscores\.julienmalige\.com\/;/, "who asks, and where to find them");
});

test("names are expanded together, twenty to a request, one answer each", async () => {
  const { asked, wiki } = api((q) => ({ expandtemplates: { wikitext: q.get("text").split("\n@@TVSCORES@@\n").map((t) => `[[${t}]]`).join("\n@@TVSCORES@@\n") } }));
  const names = Array.from({ length: 25 }, (_, i) => `{{ru|T${i}}}`);
  const out = await wiki.expand("fr", "Championnat", names);
  assert.equal(out.length, 25);
  assert.equal(out[24], "[[{{ru|T24}}]]");
  assert.equal(asked.length, 2);
  assert.equal(asked[0].url.searchParams.get("title"), "Championnat", "as that page would show them");
});

test("an answer that is an error is an error", async () => {
  const busy = api(() => ({ error: { code: "maxlag", info: "Waiting for a database server" } }));
  await assert.rejects(busy.wiki.pages("en", ["X"]), /Wikipedia en: maxlag/);
  const short = api(() => ({ expandtemplates: { wikitext: "only one" } }));
  await assert.rejects(short.wiki.expand("en", "X", ["a", "b"]), /1 names back for 2/);
});

test("an article's address is the one Wikipedia gives it", () => {
  assert.equal(articleUrl("fr", "Championnat de France de rugby à XV 2026-2027"), "https://fr.wikipedia.org/wiki/Championnat_de_France_de_rugby_%C3%A0_XV_2026-2027");
});
