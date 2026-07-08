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

## Querying a watchlist from outside the browser

The keyword watchlist normally lives in the browser's `localStorage`, but
`GET /api/watchlist?keywords=zelda,mario&tz=America/New_York` exposes the same
matching logic statelessly: it auto-detects the current event and returns
today's runs (in the given time zone) that match the given keywords. Useful
for wiring up an alert from cron, a launcher app, or any other script that
can make an HTTP request.
