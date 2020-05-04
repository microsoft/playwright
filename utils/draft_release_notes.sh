#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname $0)"

git fetch --tags git@github.com:microsoft/playwright.git >/dev/null 2>/dev/null
LAST_RELEASE=$(git describe --tags $(git rev-list --tags --max-count=1))

echo "## Browser Versions"
echo
node ./print_versions.js
echo
echo "## Highlights"
echo
echo "TODO: \`git diff ${LAST_RELEASE}:docs/api.md docs/api.md\`"
echo
echo "## Breaking API Changes"
echo
echo "TODO: \`git diff ${LAST_RELEASE}:docs/api.md docs/api.md\`"
echo
echo "## New APIs"
echo
echo "TODO: \`git diff ${LAST_RELEASE}:docs/api.md docs/api.md\`"
echo
echo "## Bug Fixes"
echo
./list_closed_issues.sh "${LAST_RELEASE}"
echo
echo "## Raw Notes"
echo
git log --pretty="%h - %s" "${LAST_RELEASE}"..HEAD

