import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";

/**
 * Ten seconds, not thirty: a score in stoppage time is worth asking about
 * again, and asking costs a header exchange when nothing changed.
 */
const SHORT_CACHE = "public, max-age=10";

/**
 * A body ready to send: its JSON, its tag, and its gzip, made once. `tagOf`
 * names what the tag is made of when some of the body must not count: the
 * scoreboard's `generatedAt` moves every rebuild and is not a change.
 */
export function prepare(body, { tagOf = body, window = 0, now = Date.now() } = {}) {
  const json = JSON.stringify(body);
  const seed = tagOf === body ? json : JSON.stringify(tagOf);
  // `window` lets a 304 stand for a few minutes at most, so the clock a client
  // reads off the body (generatedAt) cannot go stale behind it.
  const bucket = window ? `-${Math.floor(now / window)}` : "";
  const etag = `"${createHash("sha1").update(seed).digest("base64url")}${bucket}"`;
  return { json, etag, gz: undefined };
}

/**
 * JSON with an ETag, and a bodyless 304 when the caller already has it, gzipped
 * when the caller takes it: the board is ~180 KB of repetitive text and a
 * television asks for it every minute while a game is on.
 */
export function send(res, status, body, extra = {}, req, prepared = prepare(body)) {
  const { etag } = prepared;
  if (status === 200 && req?.headers["if-none-match"] === etag) {
    res.writeHead(304, { etag, "cache-control": SHORT_CACHE, "access-control-allow-origin": "*", ...extra });
    return res.end();
  }
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "public, max-age=30",
    "access-control-allow-origin": "*",
    vary: "accept-encoding",
    etag,
    ...extra,
  };
  if (/\bgzip\b/.test(req?.headers["accept-encoding"] || "") && prepared.json.length > 1024) {
    prepared.gz ??= gzipSync(prepared.json);
    res.writeHead(status, { ...headers, "content-encoding": "gzip", "content-length": prepared.gz.length });
    return res.end(prepared.gz);
  }
  res.writeHead(status, headers);
  res.end(prepared.json);
}

/** A timezone as the one canonical name it stands for, or null: IANA names only, so the variants cannot multiply. */
const TZ_SHAPE = /^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+){0,2}$/;
const tzNames = new Map();
export function canonicalTz(raw) {
  if (tzNames.has(raw)) return tzNames.get(raw);
  let name = null;
  if (TZ_SHAPE.test(raw)) {
    try {
      name = new Intl.DateTimeFormat("en", { timeZone: raw }).resolvedOptions().timeZone;
    } catch { /* not a zone */ }
  }
  if (tzNames.size >= 512) tzNames.clear();
  tzNames.set(raw, name);
  return name;
}
