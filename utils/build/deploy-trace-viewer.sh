#!/usr/bin/env bash

set -e

if [[ ($1 == '--help') || ($1 == '-h') ]]; then
  echo "usage: $(basename $0) {--stable,--beta,--canary}"
  echo
  echo "Build the Trace Viewer and push it to the GitHub repository."
  echo
  echo "NOTE: the following env variables are required:"
  echo "  GH_SERVICE_ACCOUNT_TOKEN     GitHub token with access to the microsoft/trace.playwright.dev repository"
  echo "  GITHUB_SHA                   GitHub commit SHA - injected via GitHub Actions"
  echo
  echo "This script is designed to get executed via GitHub Actions"
  exit 0
fi

if [[ -z "${GH_SERVICE_ACCOUNT_TOKEN}" ]]; then
  echo "NOTE: GH_SERVICE_ACCOUNT_TOKEN environment variable is required"
  exit 1
fi

RELEASE_CHANNEL="$1"

# 1. Install dependencies and build the Trace Viewer
npm ci
npm run build

# 2. Configure Git and clone the Trace Viewer repository
git config --global user.name github-actions
git config --global user.email 41898282+github-actions[bot]@users.noreply.github.com
git clone "https://${GH_SERVICE_ACCOUNT_TOKEN}@github.com/microsoft/trace.playwright.dev.git" trace.playwright.dev

# 3. Copy the built Trace Viewer to the repository
if [[ "${RELEASE_CHANNEL}" == "--stable" ]]; then
  rm -rf trace.playwright.dev/docs/
  mkdir trace.playwright.dev/docs/
  cp -r packages/playwright-core/lib/vite/traceViewer/* trace.playwright.dev/docs/

  # Restore CNAME, beta/ & next/ branches.
  cd trace.playwright.dev/
  git checkout docs/beta
  git checkout docs/next
  git checkout docs/CNAME
  cd -

  echo "Updated stable version"
elif [[ "${RELEASE_CHANNEL}" == "--canary" ]]; then
  rm -rf trace.playwright.dev/docs/next/
  cp -r packages/playwright-core/lib/vite/traceViewer/ trace.playwright.dev/docs/next/
  echo "Updated canary version"
elif [[ "${RELEASE_CHANNEL}" == "--beta" ]]; then
  rm -rf trace.playwright.dev/docs/beta/
  cp -r packages/playwright-core/lib/vite/traceViewer/ trace.playwright.dev/docs/beta/
  echo "Updated beta version"
else
  echo "ERROR: unknown environment - ${RELEASE_CHANNEL}"
  exit 1
fi

# 4. Commit and push the changes
cd trace.playwright.dev/
git add .
if [[ "$(git status --porcelain)" == "" ]]; then
    echo "there are no changes";
    exit 0;
fi
git commit -m "Update Trace Viewer
Upstream commit: https://github.com/microsoft/playwright/commit/$GITHUB_SHA"
git push origin

echo "Pushed changes successfully!"
