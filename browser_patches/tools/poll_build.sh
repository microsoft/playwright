#!/bin/bash
set -e
set +x

if [[ ($1 == '--help') || ($1 == '-h') ]]; then
  echo "usage: $(basename $0) [firefox|webkit]"
  echo
  echo "Pull from upstream & run checkout_build_archive_upload.sh in a loop"
fi

if [[ $# == 0 ]]; then
  echo "missing browser: 'firefox' or 'webkit'"
  echo "try './$(basename $0) --help' for more information"
  exit 1
fi

if [[ (-z $AZ_ACCOUNT_KEY) || (-z $AZ_ACCOUNT_NAME) ]]; then
  echo "ERROR: Either \$AZ_ACCOUNT_KEY or \$AZ_ACCOUNT_NAME environment variable is missing."
  echo "       'Azure Account Name' and 'Azure Account Key' secrets that are required"
  echo "       to upload builds ot Azure CDN."
  exit 1
fi

if ! command -v az >/dev/null; then
  echo "ERROR: az is not found in PATH"
  exit 1
fi

BROWSER_NAME=""
if [[ ("$1" == "firefox") || ("$1" == "firefox/") ]]; then
  BROWSER_NAME="firefox"
elif [[ ("$1" == "webkit") || ("$1" == "webkit/") ]]; then
  BROWSER_NAME="webkit"
else
  echo ERROR: unknown browser - "$1"
  exit 1
fi

# make sure the lockfile is removed when we exit and then claim it
trap "cd $(pwd -P);" EXIT
cd "$(dirname "$0")"

# Check if git repo is dirty.
if [[ -n $(git status -s) ]]; then
  echo "ERROR: $FRIENDLY_CHECKOUT_PATH has dirty GIT state - commit everything and re-run the script."
  exit 1
fi

iteration=0
while true; do
  iteration=$(( iteration + 1 ))
  echo "== ITERATION ${iteration} =="
  git pull origin master
  ../checkout_build_archive_upload.sh $BROWSER_NAME
  echo "------ Sleeping for 300 seconds before next turn... ------"
  sleep 300
done;
