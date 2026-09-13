/** Small fetch wrapper: JSON, timeout, and the API-Sports rate-limit header. */
export async function getJson(url, { headers = {}, timeoutMs = 15000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { accept: "application/json", ...headers }, signal: ctrl.signal });
    const remaining = Number(res.headers.get("x-ratelimit-requests-remaining"));
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const body = await res.json();
    return { body, remaining: Number.isFinite(remaining) ? remaining : undefined };
  } finally {
    clearTimeout(t);
  }
}
