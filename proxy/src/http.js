/** Small fetch wrapper: JSON, timeout, and the API-Sports rate-limit header. */
export async function getJson(url, { headers = {}, timeoutMs = 15000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { accept: "application/json", ...headers }, signal: ctrl.signal });
    const remainingHeader = res.headers.get("x-ratelimit-requests-remaining");
    const remaining = remainingHeader == null ? NaN : Number(remainingHeader);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    // An empty 200 is how some providers say "nothing here" — a cup with no
    // league table, a season that has not started. That is an answer, not a
    // parse error, so it comes back as null rather than throwing.
    const text = await res.text();
    const body = text.trim() ? JSON.parse(text) : null;
    return { body, remaining: Number.isFinite(remaining) ? remaining : undefined };
  } finally {
    clearTimeout(t);
  }
}
