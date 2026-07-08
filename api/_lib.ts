/**
 * Shared plumbing for the tracker proxy functions. Underscore-prefixed so
 * Vercel's zero-config runtime does not turn this into a route.
 */

export const TRACKER = 'https://tracker.gamesdonequick.com/tracker/api/v2';
export const MAX_PAGES = 10;
export const REQUEST_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; my-gdq/1.0)' };

/**
 * Follow a paginated tracker endpoint and merge every page's results into one array.
 * @param url First page URL.
 * @returns Merged results, or an error to relay upstream.
 */
export async function fetchAllPages(
  url: string,
): Promise<{ results: unknown[] } | { error: string; status: number }> {
  const results: unknown[] = [];
  let next: string | null = url;
  let pages = 0;
  while (next && pages < MAX_PAGES) {
    const upstream: Response = await fetch(next, { headers: REQUEST_HEADERS });
    if (!upstream.ok) {
      return { error: `Tracker responded with ${upstream.status}.`, status: 502 };
    }
    const data: { results?: unknown[]; next?: string | null } = await upstream.json();
    results.push(...(data.results ?? []));
    next = data.next ?? null;
    pages += 1;
  }
  return { results };
}
