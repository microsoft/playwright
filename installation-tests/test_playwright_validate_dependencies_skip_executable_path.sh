#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

npm_i playwright-core
npm_i playwright

OUTPUT="$(node validate-dependencies-skip-executable-path.js)"
if [[ "${OUTPUT}" == *"PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS"* ]]; then
  echo "ERROR: validateDependencies was called"
  exit 1
fi

