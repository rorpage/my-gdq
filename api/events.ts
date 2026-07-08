import type { VercelRequest, VercelResponse } from '@vercel/node';
import { TRACKER, fetchAllPages } from './_lib.js';

/**
 * Proxy for GET /tracker/api/v2/events/.
 * Exists so the browser never has to care about the tracker's CORS policy.
 * Follows pagination up to MAX_PAGES and returns one merged results array.
 */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const page = await fetchAllPages(`${TRACKER}/events/`);
    if ('error' in page) {
      res.status(page.status).json({ error: page.error });
      return;
    }
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
    res.status(200).json({ results: page.results });
  } catch {
    res.status(502).json({ error: 'Could not reach the GDQ tracker.' });
  }
}
