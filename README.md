# My GDQ

A filtered Games Done Quick schedule. Pick an event, add game keywords like "zelda" or "mario", and see only matching runs. Dark green, JetBrains Mono, no build step.

## Run locally

    npm install
    npx vercel dev

`vercel dev` serves index.html and runs the TypeScript functions in `api/`.

## Test

    npm test

## Deploy

    npx vercel

No environment variables needed. See AGENTS.md for conventions and decisions.

## Alerting on a watchlist from outside the browser

The keyword watchlist normally lives in the browser's `localStorage`, but
`GET /api/watchlist?keywords=zelda,mario&tz=America/New_York` exposes the same
matching logic statelessly: it auto-detects the current event and returns
today's runs (in the given time zone) that match the given keywords.

`alfred/watchlist-alert.sh` wraps that endpoint for a macOS Alfred workflow:
add a "Run Script" step calling it, set `MY_GDQ_URL` and `MY_GDQ_KEYWORDS` as
workflow variables, and trigger it on a Timer. It fires a macOS notification
when any of today's runs match.
