#!/bin/bash
source ./initialize_test.sh && initialize_test "$@"

npm_i playwright-core
npm_i playwright

echo "Running playwright codegen"
OUTPUT=$(PWTEST_CLI_EXIT=1 npx playwright codegen)
if [[ "${OUTPUT}" != *"@playwright/test"* ]]; then
  echo "ERROR: missing @playwright/test in the output"
  exit 1
fi
if [[ "${OUTPUT}" != *"{ page }"* ]]; then
  echo "ERROR: missing { page } in the output"
  exit 1
fi

echo "Running playwright codegen --target=javascript"
OUTPUT=$(PWTEST_CLI_EXIT=1 npx playwright codegen --target=javascript)
if [[ "${OUTPUT}" != *"playwright"* ]]; then
  echo "ERROR: missing playwright in the output"
  exit 1
fi
if [[ "${OUTPUT}" != *"page.close"* ]]; then
  echo "ERROR: missing page.close in the output"
  exit 1
fi

echo "Running playwright codegen --target=python"
OUTPUT=$(PWTEST_CLI_EXIT=1 npx playwright codegen --target=python)
if [[ "${OUTPUT}" != *"chromium.launch"* ]]; then
  echo "ERROR: missing chromium.launch in the output"
  exit 1
fi
if [[ "${OUTPUT}" != *"browser.close"* ]]; then
  echo "ERROR: missing browser.close in the output"
  exit 1
fi
