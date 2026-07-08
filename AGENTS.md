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
- `api/_lib.ts`: shared tracker constants and `fetchAllPages()`. Underscore prefix keeps Vercel from routing it.
- `api/events.ts`: proxy for `GET https://tracker.gamesdonequick.com/tracker/api/v2/events/`.
- `api/runs.ts`: proxy for `GET https://tracker.gamesdonequick.com/tracker/api/v2/events/{id}/runs/`, takes `?event=ID`.
- `api/watchlist.ts`: stateless keyword-match endpoint for external callers (Alfred, cron, curl). Takes `?keywords=a,b,c&tz=IANA/Zone`, auto-detects the current event, and returns today's matching runs. See `alfred/watchlist-alert.sh`.

## Key decisions

- **Proxy instead of direct browser calls.** The tracker's CORS policy is not something we control, so both endpoints go through `api/` functions, same pattern as Rutetid's Entur proxies. The functions also merge paginated responses (capped at 10 pages) so the client always gets one flat `results` array.
- **Keyword watchlist instead of per-run stars.** The user keeps a list of keywords ("zelda", "mario", or a runner name); `matchesAnyKeyword()` does a case-insensitive substring match across the run title and runner names. Keywords naturally carry across events and match whole franchises, which per-run stars could not. Stored in localStorage under `my-gdq:keywords`. The "my games" toggle defaults to on; an empty keyword list shows a setup hint rather than an empty schedule.
- **Selected event mirrored to the URL** via `?event=ID` and `history.replaceState`, so a filtered view of a specific event is shareable and survives refresh.
- **Live indicator is client-side only.** `isLive()` compares wall clock to run start/end. No polling; a refresh updates it. Good enough for v1.
- **Edge caching on the proxies.** Events cache for 10 minutes, runs for 2 minutes with stale-while-revalidate, since schedules shift during events.
- **Keywords stay stateless server-side.** The web app's watchlist lives only in the browser's `localStorage`; there is no account system to sync it against. `api/watchlist.ts` mirrors that: the caller (e.g. an Alfred workflow) passes its own keyword list as a query param on every request rather than the server remembering one. This keeps the endpoint a pure function of its inputs, consistent with the no-backend-state design.
- **Current event is "most recently started."** The tracker's public API exposes an event `datetime` but no explicit end date, and the only way to learn the tracker's own notion of "current event" is the `/schedule` page's server-side 302, which we do not proxy. `pickCurrentEvent()` (`js/schedule-utils.js`) approximates it instead: the event with the latest `datetime` that is not in the future, falling back to the soonest upcoming one before any event has started. Good enough since marathons run days apart.
- **"Today" is the caller's local day, not the server's.** `api/watchlist.ts` takes a `?tz=IANA/Zone` param and buckets runs by local calendar day in that zone (`Intl.DateTimeFormat('en-CA', ...)` for a sortable `YYYY-MM-DD` key), matching the `groupRunsByDay()` approach already used client-side. Omitting `tz` defaults to UTC, which is wrong for most callers, so real usage (the Alfred script) always passes it.

## API notes

The GDQ donation tracker is open source (GamesDoneQuick/donation-tracker). The v2 API returns `{count, next, previous, results}`. Run objects include zoned ISO 8601 `starttime`/`endtime`, `category`, `console`, and `runners` (array of objects with `name`). The bare `/schedule` page 302s to `/schedule/{eventId}` for the current event.

## Open questions

- **Tracker request headers.** The proxies now send a browser-like User-Agent to the tracker API, on the theory that bare server-side fetches were getting blocked. This is unverified: the sandbox this was written in cannot reach `gamesdonequick.com` or `tracker.gamesdonequick.com` at all (blocked by its own egress policy), so the fix could not be tested end to end. Confirm after deploy that `/api/events` and `/api/runs?event=66` actually return data for SGDQ 2026; if they still fail, capture the upstream status code and response body (the proxies currently swallow both on error) to diagnose further.

## Session history

### 2026-07-06: Initial build

Scaffolded the whole app in one session as "Splits": pure utils with passing tests, the root component, both proxy functions, and this documentation. Deploy target is Vercel via `vercel` CLI.

### 2026-07-06: Rename to My GDQ, keywords replace stars

Renamed the app to My GDQ. Replaced per-run starring with a persistent keyword watchlist (chips UI, Enter or Add button to add, one click to remove). Filtering to the watchlist is now the default view; matched titles render in the accent green even when viewing the full schedule. Tests updated, 11 passing. Open ideas for later: auto-refresh while an event is live, highlight-scroll to the current run, iCal export of watchlist runs.

### 2026-07-06: Keywords also match runners

Extended `matchesAnyKeyword()` to search runner names alongside the game title, so a runner's handle in the watchlist surfaces all of their runs. One shared keyword list covers both; no separate runner UI needed. Tests updated, 11 passing.

### 2026-07-08: Tracker moved to its own subdomain

The SGDQ 2026 schedule stopped loading; user reported watching the official `gamesdonequick.com/schedule/66` page and seeing no API calls at all. Research turned up that GDQ split its site: the classic donation-tracker Django app (same `/tracker/api/v2/` REST endpoints, same integer event IDs) now lives at `tracker.gamesdonequick.com` instead of `gamesdonequick.com/tracker`, while `gamesdonequick.com` itself is a newer marketing/schedule frontend that renders server-side, which is why its network tab showed nothing to reverse-engineer. Updated both proxies to the new base URL and added a browser-like User-Agent header, since direct fetches to the tracker were coming back 403 (Cloudflare bot protection was the leading theory). Not verified live: this sandbox's egress policy blocks `gamesdonequick.com` and its subdomains outright, so the fix needs confirmation after deploy. See "Open questions" above.

### 2026-07-08: Watchlist endpoint for Alfred alerts

User asked whether filtering happens in the UI or the API (it is entirely client-side, see `filterRuns()`), then wanted a way for a macOS Alfred workflow to ask "any of my games today?" and get notified. Since keywords only ever lived in `localStorage`, added `api/watchlist.ts`: a stateless endpoint that takes `?keywords=a,b,c&tz=IANA/Zone`, auto-detects the current event via the new `pickCurrentEvent()` pure function, and returns today's runs (in the caller's local day) matching those keywords. Extracted `fetchAllPages()` into `api/_lib.ts` so `events.ts`, `runs.ts`, and the new endpoint share one pagination implementation instead of three copies. Added `alfred/watchlist-alert.sh`, a script for an Alfred "Run Script" step (triggered by a Timer) that curls the endpoint and fires a macOS notification when there are matches. Tests: 3 new cases for `pickCurrentEvent()`, 14 passing total. Not verified against the live tracker for the same egress reason as the previous entry; the "current event" heuristic and the endpoint's shape should be sanity-checked after deploy.
