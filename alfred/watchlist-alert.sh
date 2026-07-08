#!/bin/bash
# Checks /api/watchlist and fires a macOS notification if any tracked games
# are scheduled today. Meant to run as a "Run Script" step in an Alfred
# workflow, kicked off by a Timer trigger (e.g. every 30 minutes during an
# event).
#
# Configure as Alfred workflow variables (Workflow Configuration > Variables),
# or export them before running standalone:
#   MY_GDQ_URL       Base URL of your deployed my-gdq instance,
#                    e.g. https://my-gdq.vercel.app
#   MY_GDQ_KEYWORDS  Comma-separated watchlist, e.g. "zelda,mario,zoast"

set -euo pipefail

: "${MY_GDQ_URL:?Set MY_GDQ_URL to your deployed my-gdq instance}"
: "${MY_GDQ_KEYWORDS:?Set MY_GDQ_KEYWORDS to a comma-separated watchlist}"

tz=$(readlink /etc/localtime | sed 's#.*/zoneinfo/##')

response=$(curl -fsS -G "$MY_GDQ_URL/api/watchlist" \
  --data-urlencode "keywords=$MY_GDQ_KEYWORDS" \
  --data-urlencode "tz=$tz")

python3 - "$response" <<'PY'
import json
import subprocess
import sys

data = json.loads(sys.argv[1])
matches = data.get("matches", [])
if not matches:
    sys.exit(0)

lines = []
for m in matches:
    runners = ", ".join(m.get("runners", []))
    lines.append(f"{m.get('name')} ({runners}) at {m.get('starttime')}")

title = f"{len(matches)} game(s) on your watchlist today"
message = "\n".join(lines)[:240]
subprocess.run([
    "osascript", "-e",
    f'display notification {json.dumps(message)} with title {json.dumps(title)} sound name "Glass"',
])
PY
