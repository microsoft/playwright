#!/bin/bash
# Demo: agent-like interactions on playwright.dev in an endless loop.
# Usage: ./demo-ghost.sh

set -euo pipefail

SESSION="ghost-demo"
CLI="npm run --silent playwright-cli -- -s $SESSION"
SNAP_DIR=".playwright-cli"

cleanup() {
  echo "closing session..."
  $CLI close 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

# ── helpers ──────────────────────────────────────────────────────────────────

# ref_for <text> — extract the first element ref whose snapshot line matches
ref_for() {
  local text="$1"
  local latest
  latest=$(ls -t "$SNAP_DIR"/page-*.yml 2>/dev/null | head -1)
  if [[ -z "$latest" ]]; then return 1; fi
  grep -i "$text" "$latest" \
    | grep -oE 'ref=e[0-9]+' \
    | head -1 \
    | sed 's/ref=//'
}

snap() { $CLI snapshot >/dev/null 2>&1; }
run()  { "$@" >/dev/null 2>&1; }
say()  { echo "  $*"; }

# ── bootstrap ────────────────────────────────────────────────────────────────

echo "opening browser…"
run $CLI open https://playwright.dev
sleep 2

# ── loop ─────────────────────────────────────────────────────────────────────

N=0
while true; do
  N=$((N + 1))
  echo "── loop $N ──"

  say "goto playwright.dev"
  run $CLI goto https://playwright.dev
  sleep 2

  snap; say "snapshot"

  REF=$(ref_for "Get started") || true
  if [[ -n "$REF" ]]; then
    say "click $REF  # Get started"
    run $CLI click "$REF"
    sleep 2
  fi

  snap; say "snapshot"

  say "scroll down"
  run $CLI mousewheel 400 0
  sleep 1

  REF=$(ref_for "Writing tests") || true
  if [[ -n "$REF" ]]; then
    say "click $REF  # Writing tests"
    run $CLI click "$REF"
    sleep 2
  fi

  snap; say "snapshot"

  say "scroll down"
  for _ in 1 2 3; do run $CLI mousewheel 300 0; sleep 0.4; done
  sleep 1

  REF=$(ref_for "Generating tests") || true
  if [[ -n "$REF" ]]; then
    say "click $REF  # Generating tests"
    run $CLI click "$REF"
    sleep 2
  fi

  snap; say "snapshot"

  say "scroll down"
  for _ in 1 2 3 4; do run $CLI mousewheel 200 0; sleep 0.3; done
  sleep 1

  # search
  snap
  REF=$(ref_for "Search") || true
  if [[ -n "$REF" ]]; then
    say "click $REF  # Search"
    run $CLI click "$REF"
    sleep 1

    say 'type "locator assertions"'
    run $CLI type "locator assertions"
    sleep 2

    say "press Escape"
    run $CLI press Escape
    sleep 1
  fi

  say "go-back"
  run $CLI go-back
  sleep 1
  say "go-back"
  run $CLI go-back
  sleep 1

  # API page
  snap
  REF=$(ref_for '"API"') || true
  if [[ -n "$REF" ]]; then
    say "click $REF  # API"
    run $CLI click "$REF"
    sleep 2
  fi

  say "scroll down"
  for _ in 1 2 3 4 5; do run $CLI mousewheel 300 0; sleep 0.3; done
  sleep 1

  say "hover"
  run $CLI mousemove 400 300; sleep 0.4
  run $CLI mousemove 600 450; sleep 0.4
  run $CLI mousemove 250 500; sleep 0.4

  # language switcher
  snap
  REF=$(ref_for "Python") || true
  if [[ -n "$REF" ]]; then
    say "click $REF  # Python"
    run $CLI click "$REF"
    sleep 2

    snap
    REF=$(ref_for "Node.js") || true
    if [[ -n "$REF" ]]; then
      say "click $REF  # Node.js"
      run $CLI click "$REF"
      sleep 2
    fi
  fi

  sleep 1
done
