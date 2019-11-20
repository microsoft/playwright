#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

if [[ ($1 == '--help') || ($1 == '-h') ]]; then
  echo "usage: export.sh [firefox|webkit] [custom_checkout_path]"
  echo
  echo "Exports BASE_REVISION and patch from the checkout to browser folder."
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
# Export path is where we put the patches and BASE_REVISION
EXPORT_PATH=""
BASE_BRANCH=""
if [[ ("$1" == "firefox") || ("$1" == "firefox/") ]]; then
  # we always apply our patches atop of beta since it seems to get better
  # reliability guarantees.
  BASE_BRANCH="origin/beta"
  FRIENDLY_CHECKOUT_PATH="//browser_patches/firefox/checkout";
  CHECKOUT_PATH="$PWD/firefox/checkout"
  EXPORT_PATH="$PWD/firefox/"
elif [[ ("$1" == "webkit") || ("$1" == "webkit/") ]]; then
  # webkit has only a master branch.
  BASE_BRANCH="origin/master"
  FRIENDLY_CHECKOUT_PATH="//browser_patches/webkit/checkout";
  CHECKOUT_PATH="$PWD/webkit/checkout"
  EXPORT_PATH="$PWD/webkit/"
else
  echo ERROR: unknown browser to export - "$1"
  exit 1
fi

# we will use this just for beauty.
if [[ $# == 2 ]]; then
  echo "WARNING: using custom checkout path $CHECKOUT_PATH"
  CHECKOUT_PATH=$2
  FRIENDLY_CHECKOUT_PATH="<custom_checkout>"
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

# Check if git repo is dirty.
if [[ -n $(git status -s) ]]; then
  echo "ERROR: $FRIENDLY_CHECKOUT_PATH has dirty GIT state - aborting export."
  exit 1
else
  echo "-- checking $FRIENDLY_CHECKOUT_PATH is clean - OK"
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
MERGE_BASE=$(git merge-base $BASE_BRANCH $CURRENT_BRANCH)
echo "=============================================================="
echo "    Repository:                $FRIENDLY_CHECKOUT_PATH"
echo "    Changes between branches:  $BASE_BRANCH..$CURRENT_BRANCH"
echo "    BASE_REVISION:             $MERGE_BASE"
echo
read -p "Export? Y/n " -n 1 -r
echo
# if it's not fine to reset branch - bail out.
if ! [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "Exiting."
  exit 1
fi

echo $MERGE_BASE > $EXPORT_PATH/BASE_REVISION
git checkout -b tmpsquash_export_script $MERGE_BASE
git merge --squash $CURRENT_BRANCH
git commit -am "chore: bootstrap"
PATCH_NAME=$(git format-patch -1 HEAD)
mv $PATCH_NAME $EXPORT_PATH/patches/
git checkout $CURRENT_BRANCH
git branch -D tmpsquash_export_script

# Increment BUILD_NUMBER
BUILD_NUMBER=$(cat $EXPORT_PATH/BUILD_NUMBER)
BUILD_NUMBER=$((BUILD_NUMBER+1))
echo $BUILD_NUMBER > $EXPORT_PATH/BUILD_NUMBER
