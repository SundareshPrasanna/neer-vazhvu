/** GET a JSON resource (static data file or API route). A non-OK response
 *  rejects with the URL and status, rather than parsing Next's HTML error page
 *  and failing with an unhelpful JSON SyntaxError. */
export async function fetchJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`GET ${url}: HTTP ${r.status}`);
  return (await r.json()) as T;
}

/** As fetchJson, but a missing or failing resource resolves to null - for data
 *  a city may legitimately not have. */
export async function fetchJsonOrNull<T = unknown>(url: string, init?: RequestInit): Promise<T | null> {
  const r = await fetch(url, init);
  return r.ok ? ((await r.json()) as T) : null;
}

const shared = new Map<string, Promise<unknown>>();

/** As fetchJson, but one request per URL per page session: components that
 *  read the same dataset share it. A failure is evicted so the next caller
 *  retries. Callers must not mutate the result. */
export function fetchJsonShared<T = unknown>(url: string): Promise<T> {
  let p = shared.get(url) as Promise<T> | undefined;
  if (!p) {
    p = fetchJson<T>(url).catch((err) => {
      shared.delete(url);
      throw err;
    });
    shared.set(url, p);
  }
  return p;
}
