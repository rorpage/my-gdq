# My GDQ

A filtered Games Done Quick schedule. Pick an event, keep a keyword watchlist (like "zelda" or "mario"), and see only matching runs. Times render in the viewer's local zone.

## Stack and conventions

- No build step. Static `index.html` plus ES modules in `js/`, served as-is.
- Web Components in light DOM (no shadow root) so Tailwind classes apply.
- Tailwind via CDN with an inline config. Theme: Sideline-style dark green with JetBrains Mono.
- TypeScript serverless functions in `api/`, deployed by Vercel's zero-config runtime.
- Unit tests for pure logic only, run with `npm test` (Node's built-in test runner).
- JSDoc on every exported function.
- Commits in imperative mood, directly to main.
- No em dashes anywhere: code, comments, docs, or commits.

## Architecture

- `index.html`: shell, Tailwind config, mounts `<my-gdq-app>`.
- `js/schedule-utils.js`: pure functions (filtering, grouping, formatting). Fully unit tested, no DOM or network.
- `js/app.js`: the `<my-gdq-app>` component. State on the instance, full innerHTML render passes, event delegation on the root.
- `api/events.ts`: proxy for `GET https://gamesdonequick.com/tracker/api/v2/events/`.
- `api/runs.ts`: proxy for `GET https://gamesdonequick.com/tracker/api/v2/events/{id}/runs/`, takes `?event=ID`.

## Key decisions

- **Proxy instead of direct browser calls.** The tracker's CORS policy is not something we control, so both endpoints go through `api/` functions, same pattern as Rutetid's Entur proxies. The functions also merge paginated responses (capped at 10 pages) so the client always gets one flat `results` array.
- **Keyword watchlist instead of per-run stars.** The user keeps a list of keywords ("zelda", "mario", or a runner name); `matchesAnyKeyword()` does a case-insensitive substring match across the run title and runner names. Keywords naturally carry across events and match whole franchises, which per-run stars could not. Stored in localStorage under `my-gdq:keywords`. The "my games" toggle defaults to on; an empty keyword list shows a setup hint rather than an empty schedule.
- **Selected event mirrored to the URL** via `?event=ID` and `history.replaceState`, so a filtered view of a specific event is shareable and survives refresh.
- **Live indicator is client-side only.** `isLive()` compares wall clock to run start/end. No polling; a refresh updates it. Good enough for v1.
- **Edge caching on the proxies.** Events cache for 10 minutes, runs for 2 minutes with stale-while-revalidate, since schedules shift during events.

## API notes

The GDQ donation tracker is open source (GamesDoneQuick/donation-tracker). The v2 API returns `{count, next, previous, results}`. Run objects include zoned ISO 8601 `starttime`/`endtime`, `category`, `console`, and `runners` (array of objects with `name`). The bare `/schedule` page 302s to `/schedule/{eventId}` for the current event.

## Session history

### 2026-07-06: Initial build

Scaffolded the whole app in one session as "Splits": pure utils with passing tests, the root component, both proxy functions, and this documentation. Deploy target is Vercel via `vercel` CLI.

### 2026-07-06: Rename to My GDQ, keywords replace stars

Renamed the app to My GDQ. Replaced per-run starring with a persistent keyword watchlist (chips UI, Enter or Add button to add, one click to remove). Filtering to the watchlist is now the default view; matched titles render in the accent green even when viewing the full schedule. Tests updated, 11 passing. Open ideas for later: auto-refresh while an event is live, highlight-scroll to the current run, iCal export of watchlist runs.

### 2026-07-06: Keywords also match runners

Extended `matchesAnyKeyword()` to search runner names alongside the game title, so a runner's handle in the watchlist surfaces all of their runs. One shared keyword list covers both; no separate runner UI needed. Tests updated, 11 passing.
