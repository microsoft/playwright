#!/bin/bash

set -e

if [[ ($1 == '--help') || ($1 == '-h') ]]; then
  echo "usage: $(basename $0) {canary,production}"
  echo
  echo "Build the Trace Viewer and push it to the GitHub repository."
  echo
  echo "NOTE: the following env variables are required:"
  echo "  GH_SERVICE_ACCOUNT_TOKEN     GitHub token with access to the microsoft/playwright-trace repository"
  echo "  GITHUB_SHA                   GitHub commit SHA - injected via GitHub Actions"
  echo
  echo "This script is designed to get executed via GitHub Actions"
  exit 0
fi

if [[ -z "${GH_SERVICE_ACCOUNT_TOKEN}" ]]; then
  echo "NOTE: GH_SERVICE_ACCOUNT_TOKEN environment variable is required"
  exit 1
fi

ENVIRONMENT="$1"

# 1. Install dependencies and build the Trace Viewer
npm ci
npm run build

# 2. Configure Git and clone the Trace Viewer repository
git config --global user.name github-actions
git config --global user.email 41898282+github-actions[bot]@users.noreply.github.com
git clone "https://${GH_SERVICE_ACCOUNT_TOKEN}@github.com/microsoft/playwright-trace.git" playwright-trace

# 3. Copy the built Trace Viewer to the repository
if [[ "${ENVIRONMENT}" == "production" ]]; then
  # 3.1 make a copy of the current next/ folder
  if [[ -d "playwright-trace/docs/next" ]]; then
    cp -r playwright-trace/docs/next .next-previous
  fi
  # 3.2 Clean it
  rm -rf playwright-trace/docs/
  mkdir playwright-trace/docs/
  # 3.3 Copy the old next/ back into the folder
  if [[ -d ".next-previous/" ]]; then
    mv .next-previous/ playwright-trace/docs/next/
  fi
  # 3.4 Copy the new production over
  cp -r packages/playwright-core/lib/webpack/traceViewer/* playwright-trace/docs/
  echo "Updated production version"
elif [[ "${ENVIRONMENT}" == "canary" ]]; then
  rm -rf playwright-trace/docs/next/
  cp -r packages/playwright-core/lib/webpack/traceViewer/ playwright-trace/docs/next/
  echo "Updated canary version"
else
  echo "ERROR: unknown environment - ${ENVIRONMENT}"
  exit 1
fi

# 4. Commit and push the changes
cd playwright-trace/
git add .
if [[ "$(git status --porcelain)" == "" ]]; then
    echo "there are no changes";
    exit 0;
fi
git commit -m "Update Trace Viewer
Upstream commit: https://github.com/microsoft/playwright/commit/$GITHUB_SHA"
git push origin

echo "Pushed changes successfully!"
