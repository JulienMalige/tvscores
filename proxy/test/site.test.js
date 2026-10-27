import test from "node:test";
import assert from "node:assert/strict";
import { LANGS, PAGES, pickLang } from "../src/site.js";
import { serve, raw } from "./helpers/serve.js";

const addresses = (lang) => Object.values(PAGES).map((p) => `/${lang}/${p}`);

test("every page is there in every language, and says which", async () => {
  const s = await serve();
  try {
    for (const lang of LANGS) {
      for (const address of addresses(lang)) {
        const res = await s.get(address);
        assert.equal(res.status, 200, address);
        assert.equal(res.headers.get("content-type"), "text/html; charset=utf-8");
        assert.match(res.headers.get("content-security-policy"), /default-src 'none'/, "no script, nothing from elsewhere");
        assert.match(res.headers.get("cache-control"), /no-transform/, "and Cloudflare adds none: its email hiding needs a script");
        const html = await res.text();
        assert.match(html, new RegExp(`<html lang="${lang}">`), address);
        assert.doesNotMatch(html, /\{\{|<script/i, `${address}: every blank filled, no script`);
        for (const other of addresses(lang)) assert.ok(html.includes(`href="${other}"`), `${address} links to ${other}`);
        for (const l of LANGS) assert.ok(html.includes(`hreflang="${l}"`), `${address} offers ${l}`);
      }
    }
  } finally {
    await s.close();
  }
});

test("the privacy and support pages say the same things in every language", async () => {
  const s = await serve();
  try {
    for (const page of ["privacy", "support"]) {
      const shape = async (lang) => {
        const html = await (await s.get(`/${lang}/${page}`)).text();
        return { sections: (html.match(/<h2>/g) || []).length, mail: html.includes('href="mailto:support@julienmalige.com"') };
      };
      const english = await shape("en");
      assert.ok(english.mail, `${page} gives the address to write to`);
      for (const lang of LANGS) assert.deepEqual(await shape(lang), english, `${lang}/${page} has every section of the English`);
    }
  } finally {
    await s.close();
  }
});

test("every picture and stylesheet a page names is served, under an address that changes with it", async () => {
  const s = await serve();
  try {
    const seen = new Set();
    for (const lang of LANGS) {
      for (const address of addresses(lang)) {
        const html = await (await s.get(address)).text();
        for (const [, local] of html.matchAll(/(?:src|href|srcset|content)="[^"]*?(\/(?:img\/|style)[^"\s,]*)/g)) seen.add(local);
        for (const [, set] of html.matchAll(/srcset="([^"]*)"/g)) for (const part of set.split(",")) seen.add(part.trim().split(" ")[0]);
      }
    }
    assert.ok(seen.size >= 10, "the pages name their pictures");
    for (const local of seen) {
      assert.match(local, /\?v=[A-Za-z0-9_-]{8}$/, `${local} carries its version`);
      const res = await s.get(local);
      assert.equal(res.status, 200, local);
      assert.match(res.headers.get("content-type"), /^(image\/(webp|png|svg\+xml|jpeg)|text\/css)/, local);
      assert.match(res.headers.get("cache-control"), /immutable/, local);
    }
  } finally {
    await s.close();
  }
});

test("the bare addresses go to the browser's language", async () => {
  const s = await serve();
  try {
    const where = async (path, language) => {
      const res = await s.get(path, language && { "accept-language": language });
      return res.url.replace(/^http:\/\/127\.0\.0\.1:\d+/, "");
    };
    assert.equal(await where("/", "pt-BR,pt;q=0.9,en;q=0.8"), "/pt/");
    assert.equal(await where("/", "de-DE,de;q=0.9,fr;q=0.5"), "/fr/", "the first of ours the browser takes");
    assert.equal(await where("/", "es;q=0,en;q=0.4"), "/en/", "a language refused is not chosen");
    assert.equal(await where("/"), "/en/", "English when the browser says nothing");
    assert.equal(await where("/privacy", "fr-FR,fr;q=0.9"), "/fr/privacy", "the address Apple's form can take for every language");
    assert.equal(await where("/support", "es-ES"), "/es/support");
    assert.equal(await where("/fr"), "/fr/");
    assert.equal(await where("/pt/support/"), "/pt/support");
  } finally {
    await s.close();
  }
});

test("a redirect by language is never shared between visitors", async () => {
  const s = await serve();
  try {
    const res = await fetch(`http://127.0.0.1:${s.port}/`, { redirect: "manual", headers: { "accept-language": "fr" } });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), "/fr/");
    assert.equal(res.headers.get("vary"), "accept-language");
    assert.equal(res.headers.get("cache-control"), "no-cache");
  } finally {
    await s.close();
  }
});

test("a wrong address is a page in its language, and nothing outside the site can be named", async () => {
  const s = await serve();
  try {
    const missing = await s.get("/fr/nothing-here");
    assert.equal(missing.status, 404);
    assert.match(await missing.text(), /<html lang="fr">[\s\S]*href="\/fr\/"/, "in French, with the way home");
    for (const path of ["/../package.json", "/img/../src/config.js", "/style.css/../../proxy/src/config.js", "/site/strings.json", "/en/index.html", "/layout.html"]) {
      const answer = await raw(s.port, `GET ${path} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n`);
      assert.match(answer, /^HTTP\/1\.1 404/, path);
      assert.doesNotMatch(answer, /"name"|theSportsDb|\{\{/, `${path} gives nothing away`);
    }
  } finally {
    await s.close();
  }
});

test("the data keeps its own answers beside the site", async () => {
  const s = await serve();
  try {
    const health = await s.get("/v1/health");
    assert.equal(health.status, 200);
    assert.equal((await health.json()).ok, true);
    const unknown = await s.get("/v1/nothing");
    assert.equal(unknown.status, 404);
    assert.match(unknown.headers.get("content-type"), /application\/json/, "the API's misses stay JSON");
    const posted = await fetch(`http://127.0.0.1:${s.port}/en/`, { method: "POST" });
    assert.equal(posted.status, 404, "the site only answers reads");
  } finally {
    await s.close();
  }
});

test("a page comes zipped when asked, as a 304 when unchanged, and as headers alone for HEAD", async () => {
  const s = await serve();
  try {
    const first = await s.get("/en/privacy", { "accept-encoding": "gzip" });
    assert.equal(first.headers.get("content-encoding"), "gzip");
    const etag = first.headers.get("etag");
    const again = await s.get("/en/privacy", { "if-none-match": etag });
    assert.equal(again.status, 304);
    const head = await raw(s.port, "HEAD /en/support HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n");
    assert.match(head, /^HTTP\/1\.1 200/);
    assert.match(head, /content-length: \d+/i);
    assert.doesNotMatch(head, /<html/, "no body");
  } finally {
    await s.close();
  }
});

test("a browser's languages are read in its order of preference", () => {
  assert.equal(pickLang("fr-CA"), "fr");
  assert.equal(pickLang("en-GB;q=0.5, pt-PT;q=0.8"), "pt", "by weight, not by place");
  assert.equal(pickLang("ja, es-MX"), "es");
  assert.equal(pickLang("ja"), "en");
  assert.equal(pickLang(""), "en");
  assert.equal(pickLang(undefined), "en");
});

test("a stray ?tz= on a page still gets the page, while the API still refuses it", async () => {
  const s = await serve();
  try {
    const page = await s.get("/en/privacy?tz=Not/AZone");
    assert.equal(page.status, 200);
    assert.equal(page.headers.get("content-type"), "text/html; charset=utf-8");
    assert.equal((await s.get("/v1/scoreboard?tz=Not/AZone")).status, 400);
  } finally {
    await s.close();
  }
});
