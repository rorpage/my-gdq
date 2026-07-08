import type { VercelRequest, VercelResponse } from '@vercel/node';
import { TRACKER, fetchAllPages } from './_lib.js';
import { matchesAnyKeyword, normalizeKeyword, pickCurrentEvent } from '../js/schedule-utils.js';

/**
 * Format a date as a sortable local calendar day (YYYY-MM-DD) in the given zone.
 * @param date Date to format.
 * @param timeZone IANA time zone.
 */
function localDateKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    date,
  );
}

/**
 * Auto-detects the current (or next) GDQ event, fetches its runs, and returns
 * only the ones matching the given keywords whose start time falls on the
 * caller's local "today". Built for callers that cannot read the browser's
 * localStorage watchlist, such as an Alfred workflow: GET /api/watchlist?keywords=zelda,mario&tz=America/New_York.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const keywords = String(req.query.keywords ?? '')
    .split(',')
    .map((k) => normalizeKeyword(k))
    .filter(Boolean);
  if (!keywords.length) {
    res.status(400).json({ error: 'Provide a comma-separated "keywords" query parameter.' });
    return;
  }

  const tz = String(req.query.tz ?? 'UTC');
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz });
  } catch {
    res.status(400).json({ error: `Unrecognized "tz" value: ${tz}.` });
    return;
  }

  try {
    const eventsPage = await fetchAllPages(`${TRACKER}/events/`);
    if ('error' in eventsPage) {
      res.status(eventsPage.status).json({ error: eventsPage.error });
      return;
    }

    const today = localDateKey(new Date(), tz);
    const event = pickCurrentEvent(eventsPage.results as { id: number; name?: string; short?: string }[], Date.now());
    if (!event) {
      res.status(200).json({ event: null, date: today, tz, matches: [] });
      return;
    }

    const runsPage = await fetchAllPages(`${TRACKER}/events/${event.id}/runs/`);
    if ('error' in runsPage) {
      res.status(runsPage.status).json({ error: runsPage.error });
      return;
    }

    type Run = {
      name?: string;
      category?: string;
      console?: string;
      starttime?: string;
      endtime?: string;
      runners?: (string | { name?: string })[];
    };
    const matches = (runsPage.results as Run[]).filter((run) => {
      if (!run.starttime || localDateKey(new Date(run.starttime), tz) !== today) return false;
      return matchesAnyKeyword(run, keywords);
    });

    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
    res.status(200).json({
      event: { id: event.id, name: event.name ?? event.short ?? String(event.id) },
      date: today,
      tz,
      matches: matches.map((run) => ({
        name: run.name,
        category: run.category,
        console: run.console,
        runners: (run.runners ?? []).map((r) => (typeof r === 'string' ? r : r.name)).filter(Boolean),
        starttime: run.starttime,
        endtime: run.endtime,
      })),
    });
  } catch {
    res.status(502).json({ error: 'Could not reach the GDQ tracker.' });
  }
}
