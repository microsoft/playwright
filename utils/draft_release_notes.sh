#!/usr/bin/env bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname $0)"

git fetch --tags git@github.com:microsoft/playwright.git >/dev/null 2>/dev/null
LAST_RELEASE=$(git describe --tags $(git rev-list --tags --max-count=1))

echo "## Highlights"
echo
echo "TODO: asked teammates for the highlights"
echo
echo "## Browser Versions"
echo
node ./print_versions.js
echo
echo "## New APIs"
echo
echo "TODO: \`git diff -w ${LAST_RELEASE}..HEAD src/client\`"
echo
CLOSED_ISSUES=$(./list_closed_issues.sh "${LAST_RELEASE}")
ISSUES_COUNT=$(echo "${CLOSED_ISSUES}" | wc -l | xargs)
echo "<details>"
echo "  <summary><b>Issues Closed (${ISSUES_COUNT})</b></summary>"
echo
echo "${CLOSED_ISSUES}"
echo
echo "</details>"

COMMITS=$(git log --pretty="%h - %s" "${LAST_RELEASE}"..HEAD)
COMMITS_COUNT=$(echo "${COMMITS}" | wc -l | xargs)
echo "<details>"
echo "  <summary><b>Commits (${COMMITS_COUNT})</b></summary>"
echo
echo "${COMMITS}"
echo
echo "</details>"
