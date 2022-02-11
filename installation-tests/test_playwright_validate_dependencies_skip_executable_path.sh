#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

npm install ${PLAYWRIGHT_CORE_TGZ}
npm install ${PLAYWRIGHT_TGZ}
copy_test_scripts

OUTPUT="$(node validate-dependencies-skip-executable-path.js)"
if [[ "${OUTPUT}" == *"PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS"* ]]; then
  echo "ERROR: validateDependencies was called"
  exit 1
fi

