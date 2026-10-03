import { Readable, pipeline } from "node:stream";
import { createGunzip } from "node:zlib";

/**
 * A small streaming reader for XMLTV guides: the French file is ~80 MB of
 * text, so it is read element by element and never held whole. Only
 * <channel> and <programme> are of interest; anything else is skipped.
 */

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(text) {
  return String(text).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1));
      // A malformed entity is left as written rather than failing the day's guide.
      return Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : all;
    }
    return ENTITIES[e] ?? all;
  });
}

function attributes(head) {
  return Object.fromEntries([...head.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], decode(m[2])]));
}

/** `<channel>` and `<programme>` elements, one at a time, from text chunks. */
export async function* xmltvElements(chunks) {
  let buf = "";
  const open = /<(channel|programme)\b/g;
  for await (const chunk of chunks) {
    buf += chunk;
    let at = 0;
    for (;;) {
      open.lastIndex = at;
      const m = open.exec(buf);
      // Nothing opening: keep only a tail that could be the start of a tag.
      if (!m) { at = Math.max(at, buf.length - 16); break; }
      const head = buf.indexOf(">", m.index);
      if (head < 0) { at = m.index; break; }
      if (buf[head - 1] === "/") {
        yield { tag: m[1], attrs: attributes(buf.slice(m.index, head)), body: "" };
        at = head + 1;
        continue;
      }
      const close = `</${m[1]}>`;
      const end = buf.indexOf(close, head);
      if (end < 0) { at = m.index; break; }
      yield { tag: m[1], attrs: attributes(buf.slice(m.index, head)), body: buf.slice(head + 1, end) };
      at = end + close.length;
    }
    buf = buf.slice(at);
  }
}

/** "20261003143000 +0200" -> ISO UTC. */
export function xmltvTime(stamp) {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{2})?(\d{2})?/.exec(String(stamp || ""));
  if (!m) return null;
  const sign = m[7]?.[0] === "-" ? -1 : 1;
  const offset = m[7] ? sign * (Math.abs(Number(m[7])) * 60 + Number(m[8] || 0)) : 0;
  const utc = Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) - offset * 60e3;
  return new Date(utc).toISOString();
}

const text = (body, tag) => {
  const m = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`).exec(body);
  return m ? decode(m[1]).trim() : "";
};

/**
 * What we keep of a programme: channel, start, title and sub-title — the
 * description, pictures and ratings are never read. A rerun says so with
 * <previously-shown>.
 */
export function programme({ attrs, body }) {
  return {
    channel: attrs.channel,
    start: xmltvTime(attrs.start),
    title: text(body, "title"),
    subTitle: text(body, "sub-title"),
    rerun: /<previously-shown\b/.test(body),
  };
}

/** The guide's gzipped text as a stream of utf-8 chunks. */
export async function fetchXmltv(url, { timeoutMs = 120000, fetch = globalThis.fetch } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  timer.unref?.();
  const res = await fetch(url, { signal: ctrl.signal });
  if (!res.ok) {
    clearTimeout(timer);
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const out = pipeline(Readable.fromWeb(res.body), createGunzip(), () => clearTimeout(timer));
  out.setEncoding("utf8");
  return out;
}
