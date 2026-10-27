import { readFileSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { holds, takesGzip } from "./respond.js";

/**
 * The app's website, at the address the app already uses: a home page, and the
 * privacy policy and support page the App Store asks for, in the app's four
 * languages (docs/store-release.md).
 *
 * Everything is read and put together once, at startup: site/layout.html around
 * each language's page, site/<lang>/<page>.html, with the words of
 * site/strings.json. A request can only name something on that list, so nothing
 * can walk out of site/.
 */
export const LANGS = ["en", "fr", "pt", "es"];
/** Each page, and its address under /<lang>/. */
export const PAGES = { index: "", privacy: "privacy", support: "support" };
const LOCALES = { en: "en_US", fr: "fr_FR", pt: "pt_BR", es: "es_ES" };
const TYPES = { ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg" };
const HTML = "text/html; charset=utf-8";
/** No script, no frame, nothing from elsewhere: the pages are text and pictures. */
const POLICY = "default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
/** A file's address carries its hash (?v=), so a new file is a new address and the old one can be kept a year. */
const FILE_CACHE = "public, max-age=31536000, immutable";
/**
 * Pages go out as written: without no-transform, Cloudflare hides an email
 * address behind a script of its own, which the policy above blocks, and the
 * support page would show "[email protected]" where the address should be.
 */
const PAGE_CACHE = "public, max-age=300, no-transform";

/** The first of our languages the browser asks for, in its order of preference; English otherwise. */
export function pickLang(header) {
  const asked = String(header || "").split(",").map((part, i) => {
    const [tag, ...params] = part.trim().toLowerCase().split(";");
    const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
    return { lang: tag.split("-")[0], q: q ? Number(q.slice(2)) : 1, i };
  });
  const best = asked.filter((a) => LANGS.includes(a.lang) && a.q > 0).sort((a, b) => b.q - a.q || a.i - b.i)[0];
  return best ? best.lang : "en";
}

const tagOf = (body) => `"${createHash("sha1").update(body).digest("base64url")}"`;

function entry(body, type, cache) {
  const gz = /^text\/|svg/.test(type) && body.length > 1024 ? gzipSync(body) : undefined;
  return { body, type, cache, etag: tagOf(body), gz };
}

export function createSite(dir, { publicBase }) {
  const files = new Map(); // address -> entry
  const versions = new Map(); // address -> the start of its hash
  const add = (address, file) => {
    const body = readFileSync(file);
    files.set(address, entry(body, TYPES[extname(file)], FILE_CACHE));
    versions.set(address, tagOf(body).slice(1, 9));
  };
  add("/style.css", join(dir, "style.css"));
  for (const name of readdirSync(join(dir, "img")).sort()) if (TYPES[extname(name)]) add(`/img/${name}`, join(dir, "img", name));
  const versioned = (html) => html.replace(/\/(?:style\.css|img\/[a-z0-9.-]+)(?=["\s,])/g, (address) => (versions.has(address) ? `${address}?v=${versions.get(address)}` : address));

  const strings = JSON.parse(readFileSync(join(dir, "strings.json"), "utf8"));
  const layout = readFileSync(join(dir, "layout.html"), "utf8");
  const href = (lang, page) => `/${lang}/${PAGES[page]}`;
  const fill = (template, values) => template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in values)) throw new Error(`site: nothing for {{${key}}}`);
    return values[key];
  });
  // `page` is one of PAGES, or "notFound", which has no address of its own and
  // points the language switch at each language's home.
  const render = (lang, page, content) => {
    const s = strings[lang];
    const known = page in PAGES;
    const link = (p) => `<a href="${href(lang, p)}"${p === page ? ' aria-current="page"' : ""}>${s.nav[p]}</a>`;
    const langs = LANGS.map((l) => `<a href="${href(l, known ? page : "index")}" hreflang="${l}" lang="${l}" title="${strings[l].name}"${l === lang ? ' aria-current="true"' : ""}>${l.toUpperCase()}</a>`).join("");
    const alternates = known
      ? [...LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${publicBase}${href(l, page)}">`), `<link rel="alternate" hreflang="x-default" href="${publicBase}/${PAGES[page]}">`].join("\n")
      : "";
    return versioned(fill(layout, {
      lang, page, content, alternates, langs,
      locale: LOCALES[lang],
      base: publicBase,
      url: `${publicBase}${known ? href(lang, page) : `/${lang}/`}`,
      title: s.titles[page],
      description: s.descriptions[page],
      navLabel: s.navLabel,
      langLabel: s.langLabel,
      nav: Object.keys(PAGES).map(link).join(""),
      footerNav: ["privacy", "support"].map(link).join(""),
      footer: s.footer,
    }));
  };

  const pages = new Map(); // address -> entry
  const missing = new Map(); // lang -> the page that says there is no such page
  for (const lang of LANGS) {
    for (const page of Object.keys(PAGES)) {
      const content = readFileSync(join(dir, lang, `${page}.html`), "utf8");
      pages.set(href(lang, page), entry(Buffer.from(render(lang, page, content)), HTML, PAGE_CACHE));
    }
    const s = strings[lang].notFound;
    missing.set(lang, entry(Buffer.from(render(lang, "notFound", `<article class="doc"><h1>${s.text}</h1><p><a href="/${lang}/">${s.back}</a></p></article>`)), HTML, "no-cache, no-transform"));
  }
  // Search engines may read the site, not the data.
  files.set("/robots.txt", entry(Buffer.from("User-agent: *\nDisallow: /v1/\n"), "text/plain; charset=utf-8", "public, max-age=86400"));
  files.set("/favicon.ico", entry(files.get("/img/favicon-32.png").body, "image/png", "public, max-age=86400"));

  const reply = (req, res, status, item) => {
    const headers = { "content-type": item.type, "cache-control": item.cache, etag: item.etag, "x-content-type-options": "nosniff" };
    if (item.type === HTML) Object.assign(headers, { "content-security-policy": POLICY, "referrer-policy": "strict-origin-when-cross-origin" });
    if (item.gz) headers.vary = "accept-encoding";
    if (status === 200 && holds(req.headers["if-none-match"], item.etag)) {
      res.writeHead(304, headers);
      return res.end();
    }
    const zipped = item.gz && takesGzip(req.headers["accept-encoding"]);
    const body = zipped ? item.gz : item.body;
    if (zipped) headers["content-encoding"] = "gzip";
    headers["content-length"] = body.length;
    res.writeHead(status, headers);
    res.end(req.method === "HEAD" ? undefined : body);
  };
  // To the visitor's language, which varies by visitor; or to a fixed address.
  const redirect = (res, status, location, byLanguage = false) => {
    res.writeHead(status, { location, "cache-control": byLanguage ? "no-cache" : "public, max-age=3600", ...(byLanguage ? { vary: "accept-language" } : {}) });
    res.end();
  };

  return {
    /** Answers a GET or HEAD for anything outside /v1/; false leaves the request to the caller. */
    serve(req, res, path) {
      if (req.method !== "GET" && req.method !== "HEAD") return false;
      const item = files.get(path) ?? pages.get(path);
      if (item) return reply(req, res, 200, item), true;
      const lang = pickLang(req.headers["accept-language"]);
      const bare = path.slice(1);
      if (path === "/" || (bare && Object.values(PAGES).includes(bare))) return redirect(res, 302, `/${lang}/${bare}`, true), true;
      if (LANGS.includes(bare)) return redirect(res, 301, `/${bare}/`), true;
      if (path.endsWith("/") && pages.has(path.slice(0, -1))) return redirect(res, 301, path.slice(0, -1)), true;
      // A wrong address on the site: said in the address's language, or else the browser's.
      const own = path.split("/")[1];
      reply(req, res, 404, missing.get(LANGS.includes(own) ? own : lang));
      return true;
    },
  };
}
