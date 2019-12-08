#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

REMOTE_BROWSER_UPSTREAM="browser_upstream"
BUILD_BRANCH="playwright-build"

if [[ ($1 == '--help') || ($1 == '-h') ]]; then
  echo "usage: export.sh [firefox|webkit] [custom_checkout_path]"
  echo
  echo "Exports patch from the current branch of the checkout to browser folder."
  echo "The checkout has to be 'prepared', meaning that 'prepare_checkout.sh' should be"
  echo "run against it first."
  echo
  echo "You can optionally specify custom_checkout_path if you have browser checkout somewhere else"
  echo "and wish to export patches from it."
  echo
  exit 0
fi

if [[ $# == 0 ]]; then
  echo "missing browser: 'firefox' or 'webkit'"
  echo "try './export.sh --help' for more information"
  exit 1
fi

# FRIENDLY_CHECKOUT_PATH is used only for logging.
FRIENDLY_CHECKOUT_PATH="";
CHECKOUT_PATH=""
EXPORT_PATH=""
if [[ ("$1" == "firefox") || ("$1" == "firefox/") ]]; then
  FRIENDLY_CHECKOUT_PATH="//browser_patches/firefox/checkout";
  CHECKOUT_PATH="$PWD/firefox/checkout"
  EXPORT_PATH="$PWD/firefox/"
  source "./firefox/UPSTREAM_CONFIG.sh"
elif [[ ("$1" == "webkit") || ("$1" == "webkit/") ]]; then
  FRIENDLY_CHECKOUT_PATH="//browser_patches/webkit/checkout";
  CHECKOUT_PATH="$PWD/webkit/checkout"
  EXPORT_PATH="$PWD/webkit/"
  source "./webkit/UPSTREAM_CONFIG.sh"
else
  echo ERROR: unknown browser to export - "$1"
  exit 1
fi

# we will use this just for beauty.
if [[ $# == 2 ]]; then
  echo "WARNING: using custom checkout path $2"
  CHECKOUT_PATH=$2
  FRIENDLY_CHECKOUT_PATH="<custom_checkout ( $2 )>"
fi

# if there's no checkout folder - bail out.
if ! [[ -d $CHECKOUT_PATH ]]; then
  echo "ERROR: $FRIENDLY_CHECKOUT_PATH is missing - nothing to export."
  exit 1;
else
  echo "-- checking $FRIENDLY_CHECKOUT_PATH exists - OK"
fi

# if folder exists but not a git repository - bail out.
if ! [[ -d $CHECKOUT_PATH/.git ]]; then
  echo "ERROR: $FRIENDLY_CHECKOUT_PATH is not a git repository! Nothing to export."
  exit 1
else
  echo "-- checking $FRIENDLY_CHECKOUT_PATH is a git repo - OK"
fi

# Switch to git repository.
cd $CHECKOUT_PATH

# Setting up |$REMOTE_BROWSER_UPSTREAM| remote and fetch the $BASE_BRANCH
if git remote get-url $REMOTE_BROWSER_UPSTREAM >/dev/null; then
  if ! [[ $(git remote get-url $REMOTE_BROWSER_UPSTREAM) == "$REMOTE_URL" ]]; then
    echo "ERROR: remote $REMOTE_BROWSER_UPSTREAM is not pointng to '$REMOTE_URL'! run `prepare_checkout.sh` first"
  fi
else
  echo "ERROR: checkout does not have $REMOTE_BROWSER_UPSTREAM; run `prepare_checkout.sh` first"
  exit 1
fi

# Check if git repo is dirty.
if [[ -n $(git status -s --untracked-files=no) ]]; then
  echo "ERROR: $FRIENDLY_CHECKOUT_PATH has dirty GIT state - aborting export."
  exit 1
else
  echo "-- checking $FRIENDLY_CHECKOUT_PATH is clean - OK"
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
NEW_BASE_REVISION=$(git merge-base $REMOTE_BROWSER_UPSTREAM/$BASE_BRANCH $CURRENT_BRANCH)
echo "=============================================================="
echo "    Repository:                $FRIENDLY_CHECKOUT_PATH"
echo "    Changes between branches:  $REMOTE_BROWSER_UPSTREAM/$BASE_BRANCH..$CURRENT_BRANCH"
echo "    BASE_REVISION:             $NEW_BASE_REVISION"
echo

git checkout -b tmpsquash_export_script $NEW_BASE_REVISION
git merge --squash $CURRENT_BRANCH

HAS_CHANGES="false"
if ! git commit -am "chore: bootstrap"; then
  echo "-- no code changes"
else
  HAS_CHANGES="true"
  PATCH_NAME=$(git format-patch -1 HEAD)
  mv $PATCH_NAME $EXPORT_PATH/patches/
fi
git checkout $CURRENT_BRANCH
git branch -D tmpsquash_export_script

if [[ "$NEW_BASE_REVISION" == "$BASE_REVISION" ]]; then
  echo "-- no BASE_REVISION changes"
else
  HAS_CHANGES="true"
fi

if [[ $HAS_CHANGES == "false" ]]; then
  exit 0
fi

echo "REMOTE_URL=\"$REMOTE_URL\"
BASE_BRANCH=\"$BASE_BRANCH\"
BASE_REVISION=\"$NEW_BASE_REVISION\"" > $EXPORT_PATH/UPSTREAM_CONFIG.sh

# Increment BUILD_NUMBER
BUILD_NUMBER=$(cat $EXPORT_PATH/BUILD_NUMBER)
BUILD_NUMBER=$((BUILD_NUMBER+1))
echo $BUILD_NUMBER > $EXPORT_PATH/BUILD_NUMBER
