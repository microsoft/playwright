#!/bin/sh
SCRIPT_PATH="$(cd "$(dirname "$0")" ; pwd -P)"
if [ -z "$PLAYWRIGHT_NODEJS_PATH" ]; then
  PLAYWRIGHT_NODEJS_PATH="$SCRIPT_PATH/node"
fi
"$PLAYWRIGHT_NODEJS_PATH" "$SCRIPT_PATH/package/lib/cli/cli.js" "$@"
