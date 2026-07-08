import type { VercelRequest, VercelResponse } from '@vercel/node';

const TRACKER = 'https://tracker.gamesdonequick.com/tracker/api/v2';
const MAX_PAGES = 10;
const REQUEST_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; my-gdq/1.0)' };

/**
 * Proxy for GET /tracker/api/v2/events/{id}/runs/.
 * Takes ?event=ID, validates it, follows pagination, and returns one
 * merged results array in schedule order.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const event = Number(req.query.event);
  if (!Number.isInteger(event) || event <= 0) {
    res.status(400).json({ error: 'Provide a positive integer "event" query parameter.' });
    return;
  }
  try {
    const results: unknown[] = [];
    let url: string | null = `${TRACKER}/events/${event}/runs/`;
    let pages = 0;
    while (url && pages < MAX_PAGES) {
      const upstream = await fetch(url, { headers: REQUEST_HEADERS });
      if (!upstream.ok) {
        res.status(502).json({ error: `Tracker responded with ${upstream.status}.` });
        return;
      }
      const data: { results?: unknown[]; next?: string | null } = await upstream.json();
      results.push(...(data.results ?? []));
      url = data.next ?? null;
      pages += 1;
    }
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
    res.status(200).json({ results });
  } catch {
    res.status(502).json({ error: 'Could not reach the GDQ tracker.' });
  }
}
