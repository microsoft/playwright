#!/usr/bin/env bash
#
# Run the webview tests against Epiphany (GNOME Web) over the WebKitGTK remote
# inspector. Extra arguments are forwarded to `playwright test`, e.g.:
#
#   tests/webview/run-epiphany.sh                       # full suite
#   tests/webview/run-epiphany.sh page-evaluate         # one file
#   tests/webview/run-epiphany.sh --grep "should work"  # by title
#
# Environment overrides:
#   PW_WEBVIEW_PORT      inspector HTTP server port (default 9233)
#   PW_WEBVIEW_BROWSER   browser binary (default: epiphany)
#   EPIPHANY_PROFILE     throwaway profile dir (default: a fresh mktemp dir)
#
set -euo pipefail

# Repo root is two levels up from this script.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

PORT="${PW_WEBVIEW_PORT:-9233}"
BROWSER="${PW_WEBVIEW_BROWSER:-epiphany}"
# A throwaway profile keeps Epiphany from attaching to an already-running
# single instance that has no inspector server.
PROFILE="${EPIPHANY_PROFILE:-$(mktemp -d /tmp/epi-rdp.XXXXXX)}"

# WebKitGTK binds the inspector on a single numeric address, so use 127.0.0.1.
export PW_WEBVIEW_PROXY_BASE="http://127.0.0.1:${PORT}"
export PW_WEBVIEW_BROWSER="$BROWSER"
export PW_WEBVIEW_BROWSER_ARGS="--private-instance --profile=${PROFILE}"

echo "Running webview tests against ${BROWSER} on ${PW_WEBVIEW_PROXY_BASE} (profile: ${PROFILE})"

# Under Xvfb when there is no display (e.g. CI), otherwise directly.
if [[ -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]] && command -v xvfb-run >/dev/null 2>&1; then
  exec xvfb-run -a npx playwright test --config tests/webview/playwright.config.ts "$@"
else
  exec npx playwright test --config tests/webview/playwright.config.ts "$@"
fi
