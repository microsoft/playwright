#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

npm_i playwright-core
npm_i playwright

OUTPUT="$(node validate-dependencies.js)"
if [[ "${OUTPUT}" != *"PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS"* ]]; then
  echo "ERROR: validateDependencies was not called"
  exit 1
fi

