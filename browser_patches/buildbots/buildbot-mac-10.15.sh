#!/bin/bash
set -e
set +x

if [[ "$(uname)" != "Darwin" ]]; then
  echo "ERROR: this script is designed to be run on OSX. Can't run on $(uname)"
  exit 1
fi

MAC_MAJOR_MINOR_VERSION=$(sw_vers -productVersion | grep -o '^\d\+.\d\+')
if [[ $MAC_MAJOR_MINOR_VERSION != "10.15" ]]; then
  echo "ERROR: this script is designed to be run on OSX 10.15. Can't run on OSX $MAC_MAJOR_MINOR_VERSION"
  exit 1
fi


if [[ ($1 == '--help') || ($1 == '-h') ]]; then
  echo "usage: $(basename $0) [firefox|webkit]"
  echo
  echo "Pull from upstream & run checkout_build_archive_upload.sh"
  echo "in a safe way so that multiple instances of the script cannot be run"
  echo
  echo "This script is designed to be run as a cronjob"
  exit 0
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

# Setup a LOCKDIR so that we don't run the same script multiple times.
LOCKDIR="/tmp/$(basename $0).lock"
if [[ -d ${LOCKDIR} ]]; then
  echo "Already running (lockdir $LOCKDIR exists. Remove it manually if running)"
  exit 0
fi

mkdir -p $LOCKDIR
# make sure the lockfile is removed when we exit and then claim it
trap "rm -rf ${LOCKDIR}; cd $(pwd -P); exit" INT TERM EXIT
cd "$(dirname "$0")"

IS_FIRST_RUN_FILE="/tmp/pw-buildbot-first-run.txt";
if ! [[ -f $IS_FIRST_RUN_FILE ]]; then
  source ./send_telegram_message.sh
  send_telegram_message '**Mac 10.15 Buildbot Is Active**'
fi
touch "$IS_FIRST_RUN_FILE"

# Check if git repo is dirty.
if [[ -n $(git status -s) ]]; then
  echo "ERROR: dirty GIT state - commit everything and re-run the script."
  exit 1
fi

git pull origin master
../checkout_build_archive_upload.sh webkit-mac-10.15 >/tmp/$(basename $0)--webkit-mac-10.15.log || true
