import type { VercelRequest, VercelResponse } from '@vercel/node';
import { TRACKER, fetchAllPages } from './_lib.js';
import { isUpcomingWithin, matchesAnyKeyword, normalizeKeyword, pickCurrentEvent } from '../js/schedule-utils.js';

const DEFAULT_LOOKAHEAD_HOURS = 24;

/**
 * Auto-detects the current (or next) GDQ event, fetches its runs, and returns
 * only the ones matching the given keywords that are live now or start within
 * the lookahead window. Built for callers that cannot read the browser's
 * localStorage watchlist: GET /api/watchlist?keywords=zelda,mario&tz=America/New_York&hours=24.
 *
 * A rolling window (rather than "today" in a given time zone) avoids missing
 * runs that start just after local midnight, since marathon schedules run
 * straight through the night.
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

  const hours = req.query.hours !== undefined ? Number(req.query.hours) : DEFAULT_LOOKAHEAD_HOURS;
  if (!Number.isFinite(hours) || hours <= 0) {
    res.status(400).json({ error: 'Provide a positive number for the "hours" query parameter.' });
    return;
  }

  try {
    const eventsPage = await fetchAllPages(`${TRACKER}/events/`);
    if ('error' in eventsPage) {
      res.status(eventsPage.status).json({ error: eventsPage.error });
      return;
    }

    const now = Date.now();
    const event = pickCurrentEvent(eventsPage.results as { id: number; name?: string; short?: string }[], now);
    if (!event) {
      res.status(200).json({ event: null, now: new Date(now).toISOString(), tz, hours, matches: [] });
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
    const matches = (runsPage.results as Run[]).filter(
      (run) => isUpcomingWithin(run, now, hours) && matchesAnyKeyword(run, keywords),
    );

    const localTimeFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
    res.status(200).json({
      event: { id: event.id, name: event.name ?? event.short ?? String(event.id) },
      now: new Date(now).toISOString(),
      tz,
      hours,
      matches: matches.map((run) => ({
        name: run.name,
        category: run.category,
        console: run.console,
        runners: (run.runners ?? []).map((r) => (typeof r === 'string' ? r : r.name)).filter(Boolean),
        starttime: run.starttime,
        endtime: run.endtime,
        starttime_local: run.starttime ? localTimeFmt.format(new Date(run.starttime)) : null,
      })),
    });
  } catch {
    res.status(502).json({ error: 'Could not reach the GDQ tracker.' });
  }
}
