import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml,
  filterRuns,
  formatDuration,
  groupRunsByDay,
  isLive,
  matchesAnyKeyword,
  matchesQuery,
  normalizeKeyword,
  runnerNames,
  sortEventsNewestFirst,
} from '../js/schedule-utils.js';

const run = (overrides = {}) => ({
  name: 'Super Metroid',
  category: 'Any%',
  console: 'SNES',
  runners: [{ name: 'oatsngoats' }, { name: 'zoast' }],
  starttime: '2026-07-06T18:00:00-04:00',
  endtime: '2026-07-06T19:17:06-04:00',
  ...overrides,
});

test('normalizeKeyword lowercases and trims', () => {
  assert.equal(normalizeKeyword('  Zelda '), 'zelda');
  assert.equal(normalizeKeyword(''), '');
  assert.equal(normalizeKeyword(undefined), '');
});

test('matchesAnyKeyword matches title and runner substrings, case-insensitively', () => {
  const zelda = run({ name: 'The Legend of Zelda: Majora\'s Mask', runners: [{ name: 'Glitchymon' }] });
  assert.equal(matchesAnyKeyword(zelda, ['zelda']), true);
  assert.equal(matchesAnyKeyword(zelda, ['mario', 'zelda']), true);
  assert.equal(matchesAnyKeyword(zelda, ['glitchymon']), true);
  assert.equal(matchesAnyKeyword(zelda, ['GLITCHY'.toLowerCase()]), true);
  assert.equal(matchesAnyKeyword(zelda, ['mario']), false);
  assert.equal(matchesAnyKeyword(zelda, []), false);
  assert.equal(matchesAnyKeyword(zelda, ['']), false);
});

test('escapeHtml neutralizes markup', () => {
  assert.equal(escapeHtml(`<b>"x" & 'y'</b>`), '&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
});

test('runnerNames joins object and string runners', () => {
  assert.equal(runnerNames(run()), 'oatsngoats, zoast');
  assert.equal(runnerNames({ runners: ['solo'] }), 'solo');
  assert.equal(runnerNames({}), '');
});

test('matchesQuery searches name, category, console, and runners', () => {
  assert.equal(matchesQuery(run(), 'metroid'), true);
  assert.equal(matchesQuery(run(), 'ANY%'), true);
  assert.equal(matchesQuery(run(), 'snes'), true);
  assert.equal(matchesQuery(run(), 'zoast'), true);
  assert.equal(matchesQuery(run(), 'zelda'), false);
  assert.equal(matchesQuery(run(), '   '), true);
});

test('filterRuns applies keywordsOnly and query together', () => {
  const runs = [run(), run({ name: 'Portal 2', runners: [{ name: 'azorae' }] })];
  const keywords = ['portal'];
  assert.equal(filterRuns(runs, { keywordsOnly: true, keywords }).length, 1);
  assert.equal(filterRuns(runs, { keywordsOnly: true, keywords, query: 'metroid' }).length, 0);
  assert.equal(filterRuns(runs, { query: 'metroid' }).length, 1);
  assert.equal(filterRuns(runs).length, 2);
  assert.equal(filterRuns(runs, { keywordsOnly: true, keywords: [] }).length, 0);
});

test('groupRunsByDay groups consecutive runs by local day', () => {
  const runs = [
    run({ starttime: '2026-07-06T22:00:00Z' }),
    run({ name: 'Portal 2', starttime: '2026-07-06T23:30:00Z' }),
    run({ name: 'Chrono Trigger', starttime: '2026-07-07T01:00:00Z' }),
  ];
  const groups = groupRunsByDay(runs, 'en-US', 'UTC');
  assert.equal(groups.length, 2);
  assert.equal(groups[0].label, 'Monday, Jul 6');
  assert.equal(groups[0].runs.length, 2);
  assert.equal(groups[1].runs[0].name, 'Chrono Trigger');
});

test('groupRunsByDay skips runs without a starttime', () => {
  const groups = groupRunsByDay([run({ starttime: undefined })], 'en-US', 'UTC');
  assert.equal(groups.length, 0);
});

test('formatDuration renders compact durations', () => {
  assert.equal(formatDuration('2026-07-06T18:00:00Z', '2026-07-06T19:17:00Z'), '1h 17m');
  assert.equal(formatDuration('2026-07-06T18:00:00Z', '2026-07-06T18:42:00Z'), '42m');
  assert.equal(formatDuration('2026-07-06T18:00:00Z', '2026-07-06T18:05:30Z'), '6m');
  assert.equal(formatDuration('bad', 'worse'), '');
  assert.equal(formatDuration('2026-07-06T19:00:00Z', '2026-07-06T18:00:00Z'), '');
});

test('isLive is true only inside the run window', () => {
  const r = run({ starttime: '2026-07-06T18:00:00Z', endtime: '2026-07-06T19:00:00Z' });
  assert.equal(isLive(r, Date.parse('2026-07-06T18:30:00Z')), true);
  assert.equal(isLive(r, Date.parse('2026-07-06T17:59:59Z')), false);
  assert.equal(isLive(r, Date.parse('2026-07-06T19:00:00Z')), false);
  assert.equal(isLive({ starttime: 'bad' }, Date.now()), false);
});

test('sortEventsNewestFirst prefers datetime, falls back to id', () => {
  const events = [
    { id: 1, name: 'AGDQ 2024', datetime: '2024-01-14T00:00:00Z' },
    { id: 3, name: 'SGDQ 2026', datetime: '2026-07-05T00:00:00Z' },
    { id: 2, name: 'AGDQ 2025', datetime: '2025-01-05T00:00:00Z' },
  ];
  assert.deepEqual(sortEventsNewestFirst(events).map((e) => e.name), ['SGDQ 2026', 'AGDQ 2025', 'AGDQ 2024']);
  const byId = [{ id: 5 }, { id: 9 }, { id: 7 }];
  assert.deepEqual(sortEventsNewestFirst(byId).map((e) => e.id), [9, 7, 5]);
});
