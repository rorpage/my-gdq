import type { VercelRequest, VercelResponse } from '@vercel/node';

const TRACKER = 'https://gamesdonequick.com/tracker/api/v2';
const MAX_PAGES = 10;

/**
 * Proxy for GET /tracker/api/v2/events/.
 * Exists so the browser never has to care about the tracker's CORS policy.
 * Follows pagination up to MAX_PAGES and returns one merged results array.
 */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const results: unknown[] = [];
    let url: string | null = `${TRACKER}/events/`;
    let pages = 0;
    while (url && pages < MAX_PAGES) {
      const upstream = await fetch(url);
      if (!upstream.ok) {
        res.status(502).json({ error: `Tracker responded with ${upstream.status}.` });
        return;
      }
      const data: { results?: unknown[]; next?: string | null } = await upstream.json();
      results.push(...(data.results ?? []));
      url = data.next ?? null;
      pages += 1;
    }
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
    res.status(200).json({ results });
  } catch {
    res.status(502).json({ error: 'Could not reach the GDQ tracker.' });
  }
}
