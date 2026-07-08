import type { VercelRequest, VercelResponse } from '@vercel/node';
import { TRACKER, fetchAllPages } from './_lib.js';

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
    const page = await fetchAllPages(`${TRACKER}/events/${event}/runs/`);
    if ('error' in page) {
      res.status(page.status).json({ error: page.error });
      return;
    }
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
    res.status(200).json({ results: page.results });
  } catch {
    res.status(502).json({ error: 'Could not reach the GDQ tracker.' });
  }
}
