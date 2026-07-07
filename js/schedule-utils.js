/**
 * Pure helpers for filtering, grouping, and formatting GDQ schedule data.
 * No DOM or network access here, so everything is unit testable with node --test.
 */

/**
 * Normalize a raw keyword into its stored form.
 * @param {string} raw User input, for example " Zelda ".
 * @returns {string} Lowercased, trimmed keyword. Empty string if nothing usable.
 */
export function normalizeKeyword(raw) {
  return String(raw || '').trim().toLowerCase();
}

/**
 * Whether a run's game title or any of its runners match a watchlist keyword.
 * An empty keyword list matches nothing, by design: the UI treats that
 * state as "watchlist not set up yet" and shows a hint instead.
 * @param {object} run Run object from the tracker API.
 * @param {string[]} keywords Normalized keywords, for example ["zelda", "zoast"].
 * @returns {boolean} True when the title or a runner matches at least one keyword.
 */
export function matchesAnyKeyword(run, keywords) {
  const haystack = `${String(run.name || '')} ${runnerNames(run)}`.toLowerCase();
  return (keywords || []).some((k) => k && haystack.includes(k));
}

/**
 * Escape a string for safe interpolation into innerHTML.
 * @param {string} value Untrusted text.
 * @returns {string} HTML-safe text.
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Join runner names from a tracker run object.
 * @param {object} run Run object from the tracker API.
 * @returns {string} Comma-separated runner names.
 */
export function runnerNames(run) {
  return (run.runners || [])
    .map((r) => (typeof r === 'string' ? r : r.name))
    .filter(Boolean)
    .join(', ');
}

/**
 * Case-insensitive substring match across game name, category, console, and runners.
 * An empty query matches everything.
 * @param {object} run Run object from the tracker API.
 * @param {string} query Search text.
 * @returns {boolean} Whether the run matches.
 */
export function matchesQuery(run, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const haystack = [run.name, run.category, run.console, runnerNames(run)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

/**
 * Filter runs by search query and, optionally, by the keyword watchlist.
 * @param {object[]} runs Runs from the tracker API, in schedule order.
 * @param {{query?: string, keywordsOnly?: boolean, keywords?: string[]}} options Filter options.
 * @returns {object[]} Filtered runs, order preserved.
 */
export function filterRuns(runs, { query = '', keywordsOnly = false, keywords = [] } = {}) {
  return runs.filter((run) => {
    if (keywordsOnly && !matchesAnyKeyword(run, keywords)) return false;
    return matchesQuery(run, query);
  });
}

/**
 * Group runs into consecutive local calendar days, preserving schedule order.
 * @param {object[]} runs Filtered runs.
 * @param {string} [locale] BCP 47 locale, defaults to the runtime locale.
 * @param {string} [timeZone] IANA time zone, defaults to the runtime zone. Pin to 'UTC' in tests.
 * @returns {{label: string, runs: object[]}[]} Ordered day groups.
 */
export function groupRunsByDay(runs, locale = undefined, timeZone = undefined) {
  const fmt = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    ...(timeZone ? { timeZone } : {}),
  });
  const groups = [];
  const byLabel = new Map();
  for (const run of runs) {
    if (!run.starttime) continue;
    const label = fmt.format(new Date(run.starttime));
    if (!byLabel.has(label)) {
      const group = { label, runs: [] };
      byLabel.set(label, group);
      groups.push(group);
    }
    byLabel.get(label).runs.push(run);
  }
  return groups;
}

/**
 * Format the gap between two zoned ISO 8601 timestamps as a compact duration.
 * @param {string} starttime ISO 8601 start.
 * @param {string} endtime ISO 8601 end.
 * @returns {string} For example "1h 17m" or "42m". Empty string if inputs are invalid.
 */
export function formatDuration(starttime, endtime) {
  const start = Date.parse(starttime);
  const end = Date.parse(endtime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return '';
  const totalMinutes = Math.round((end - start) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

/**
 * Whether a run is in progress at the given moment.
 * @param {object} run Run with starttime and endtime.
 * @param {Date|number} now Current time.
 * @returns {boolean} True when now is within [starttime, endtime).
 */
export function isLive(run, now) {
  const t = now instanceof Date ? now.getTime() : now;
  const start = Date.parse(run.starttime);
  const end = Date.parse(run.endtime);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  return t >= start && t < end;
}

/**
 * Sort tracker events newest first. Prefers the event datetime, falls back to id.
 * @param {object[]} events Events from the tracker API.
 * @returns {object[]} New sorted array, input untouched.
 */
export function sortEventsNewestFirst(events) {
  return [...events].sort((a, b) => {
    const da = Date.parse(a.datetime ?? '');
    const db = Date.parse(b.datetime ?? '');
    if (Number.isFinite(da) && Number.isFinite(db) && da !== db) return db - da;
    return (b.id ?? 0) - (a.id ?? 0);
  });
}
