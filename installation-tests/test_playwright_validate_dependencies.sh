#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

npm install ${PLAYWRIGHT_CORE_TGZ}
npm install ${PLAYWRIGHT_TGZ}

OUTPUT="$(node validate-dependencies.js)"
if [[ "${OUTPUT}" != *"PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS"* ]]; then
  echo "ERROR: validateDependencies was not called"
  exit 1
fi

