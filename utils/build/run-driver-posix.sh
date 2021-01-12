#!/bin/sh
SCRIPT_PATH="$(cd "$(dirname "$0")" ; pwd -P)"
$SCRIPT_PATH/node $SCRIPT_PATH/package/cli.js "$@"
