#!/bin/bash
set -e
set +x

if [[ ($1 == '--help') || ($1 == '-h') ]]; then
  echo "usage: $(basename $0) [firefox|webkit]"
  echo
  echo "Pull from upstream & run checkout_build_archive_upload.sh"
  echo "in a safe way so that multiple instances of the script cannot be run"
  exit 0
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

if ! which az >/dev/null; then
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

# Setup a LOCKDIR so that we don't run the same script multiple times.
LOCKDIR="/tmp/playwright__$(basename $0)-$BROWSER_NAME.lock"
if [[ -d ${LOCKDIR} ]]; then
  echo "Already running (lockdir $LOCKDIR exists. Remove it manually if running)"
  exit 0
fi
mkdir -p $LOCKDIR
# make sure the lockfile is removed when we exit and then claim it
trap "rm -rf ${LOCKDIR}; cd $(pwd -P); exit" INT TERM EXIT
cd "$(dirname "$0")"

# Check if git repo is dirty.
if [[ -n $(git status -s) ]]; then
  echo "ERROR: $FRIENDLY_CHECKOUT_PATH has dirty GIT state - commit everything and re-run the script."
  exit 1
fi

git pull origin master
../checkout_build_archive_upload.sh $BROWSER_NAME >/tmp/checkout_build_archive_upload--$BROWSER_NAME.log
