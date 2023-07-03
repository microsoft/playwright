#!/usr/bin/env bash
set -e
set +x

if [[ ($1 == '--help') || ($1 == '-h') ]]; then
  echo "usage: $(basename $0) <GIT_SHA>"
  echo
  echo "List Playwright closed issues since the given commit was landed"
  echo
  echo "Example: $(basename $0) HEAD~100"
  exit 0
fi

if [[ $# == 0 ]]; then
  echo "missing git SHA"
  echo "try './$(basename $0) --help' for more information"
  exit 1
fi

COMMIT_DATE_WEIRD_ISO=$(git show -s --format=%cd --date=iso $1)
COMMIT_DATE=$(node -e "console.log(new Date('${COMMIT_DATE_WEIRD_ISO}').toISOString())")

curl -s "https://api.github.com/repos/microsoft/playwright/issues?state=closed&since=${COMMIT_DATE}&direction=asc&per_page=100" | \
  node -e "console.log(JSON.parse(require('fs').readFileSync(0, 'utf8')).filter(issue => !issue.pull_request && new Date(issue.closed_at) > new Date('${COMMIT_DATE}')).map(issue => '#' + issue.number + ' - ' + issue.title).join('\n'))"

