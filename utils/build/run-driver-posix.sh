#!/bin/sh
SCRIPT_PATH="$(cd "$(dirname "$0")" ; pwd -P)"
_PW_PACKAGE_ROOT=$SCRIPT_PATH/package $SCRIPT_PATH/node $SCRIPT_PATH/package/lib/cli/cli.js "$@"
