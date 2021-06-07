#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

REMOTE_BROWSER_UPSTREAM="browser_upstream"
BUILD_BRANCH="playwright-build"

# COLORS
RED=$'\e[1;31m'
GRN=$'\e[1;32m'
YEL=$'\e[1;33m'
END=$'\e[0m'

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
BUILD_NUMBER_UPSTREAM_URL=""
CHECKOUT_PATH=""
EXPORT_PATH=""
EXTRA_FOLDER_PW_PATH=""
EXTRA_FOLDER_CHECKOUT_RELPATH=""
if [[ ("$1" == "firefox") || ("$1" == "firefox/") || ("$1" == "ff") ]]; then
  FRIENDLY_CHECKOUT_PATH="//browser_patches/firefox/checkout";
  CHECKOUT_PATH="$PWD/firefox/checkout"
  EXTRA_FOLDER_PW_PATH="$PWD/firefox/juggler"
  EXTRA_FOLDER_CHECKOUT_RELPATH="juggler"
  EXPORT_PATH="$PWD/firefox"
  BUILD_NUMBER_UPSTREAM_URL="https://raw.githubusercontent.com/microsoft/playwright/master/browser_patches/firefox/BUILD_NUMBER"
  source "./firefox/UPSTREAM_CONFIG.sh"
  if [[ ! -z "${FF_CHECKOUT_PATH}" ]]; then
    echo "WARNING: using checkout path from FF_CHECKOUT_PATH env: ${FF_CHECKOUT_PATH}"
    CHECKOUT_PATH="${FF_CHECKOUT_PATH}"
    FRIENDLY_CHECKOUT_PATH="<FF_CHECKOUT_PATH>"
  fi
elif [[ ("$1" == "firefox-beta") || ("$1" == "ff-beta") ]]; then
  # NOTE: firefox-beta re-uses firefox checkout.
  FRIENDLY_CHECKOUT_PATH="//browser_patches/firefox/checkout";
  CHECKOUT_PATH="$PWD/firefox/checkout"

  EXTRA_FOLDER_PW_PATH="$PWD/firefox-beta/juggler"
  EXTRA_FOLDER_CHECKOUT_RELPATH="juggler"
  EXPORT_PATH="$PWD/firefox-beta"
  BUILD_NUMBER_UPSTREAM_URL="https://raw.githubusercontent.com/microsoft/playwright/master/browser_patches/firefox-beta/BUILD_NUMBER"
  source "./firefox-beta/UPSTREAM_CONFIG.sh"
  if [[ ! -z "${FF_CHECKOUT_PATH}" ]]; then
    echo "WARNING: using checkout path from FF_CHECKOUT_PATH env: ${FF_CHECKOUT_PATH}"
    CHECKOUT_PATH="${FF_CHECKOUT_PATH}"
    FRIENDLY_CHECKOUT_PATH="<FF_CHECKOUT_PATH>"
  fi
elif [[ ("$1" == "webkit") || ("$1" == "webkit/") || ("$1" == "wk") ]]; then
  FRIENDLY_CHECKOUT_PATH="//browser_patches/webkit/checkout";
  CHECKOUT_PATH="$PWD/webkit/checkout"
  EXTRA_FOLDER_PW_PATH="$PWD/webkit/embedder/Playwright"
  EXTRA_FOLDER_CHECKOUT_RELPATH="Tools/Playwright"
  EXPORT_PATH="$PWD/webkit"
  BUILD_NUMBER_UPSTREAM_URL="https://raw.githubusercontent.com/microsoft/playwright/master/browser_patches/webkit/BUILD_NUMBER"
  source "./webkit/UPSTREAM_CONFIG.sh"
  if [[ ! -z "${WK_CHECKOUT_PATH}" ]]; then
    echo "WARNING: using checkout path from WK_CHECKOUT_PATH env: ${WK_CHECKOUT_PATH}"
    CHECKOUT_PATH="${WK_CHECKOUT_PATH}"
    FRIENDLY_CHECKOUT_PATH="<WK_CHECKOUT_PATH>"
  fi
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
  if ! [[ $(git config --get remote.$REMOTE_BROWSER_UPSTREAM.url || echo "") == "$REMOTE_URL" ]]; then
    echo "ERROR: remote $REMOTE_BROWSER_UPSTREAM is not pointing to '$REMOTE_URL'! run `prepare_checkout.sh` first"
    exit 1
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

PATCH_NAME=$(ls -1 $EXPORT_PATH/patches)
if [[ -z "$PATCH_NAME" ]]; then
  PATCH_NAME="bootstrap.diff"
  OLD_DIFF=""
else
  OLD_DIFF=$(cat $EXPORT_PATH/patches/$PATCH_NAME)
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
NEW_BASE_REVISION=$(git merge-base $REMOTE_BROWSER_UPSTREAM/$BASE_BRANCH $CURRENT_BRANCH)
NEW_DIFF=$(git diff --diff-algorithm=myers --full-index $NEW_BASE_REVISION $CURRENT_BRANCH -- . ":!${EXTRA_FOLDER_CHECKOUT_RELPATH}")

# Increment BUILD_NUMBER
BUILD_NUMBER=$(curl ${BUILD_NUMBER_UPSTREAM_URL} | head -1)
BUILD_NUMBER=$((BUILD_NUMBER+1))

echo "REMOTE_URL=\"$REMOTE_URL\"
BASE_BRANCH=\"$BASE_BRANCH\"
BASE_REVISION=\"$NEW_BASE_REVISION\"" > $EXPORT_PATH/UPSTREAM_CONFIG.sh
echo "$NEW_DIFF" > $EXPORT_PATH/patches/$PATCH_NAME
echo $BUILD_NUMBER > $EXPORT_PATH/BUILD_NUMBER
echo "Changed: $(git config user.email) $(date)" >> $EXPORT_PATH/BUILD_NUMBER

echo "-- exporting standalone folder"
rm -rf "${EXTRA_FOLDER_PW_PATH}"
mkdir -p $(dirname "${EXTRA_FOLDER_PW_PATH}")
cp -r "${EXTRA_FOLDER_CHECKOUT_RELPATH}" "${EXTRA_FOLDER_PW_PATH}"

NEW_BASE_REVISION_TEXT="$NEW_BASE_REVISION (not changed)"
if [[ "$NEW_BASE_REVISION" != "$BASE_REVISION" ]]; then
  NEW_BASE_REVISION_TEXT="$YEL$NEW_BASE_REVISION (changed)$END"
fi

echo "=============================================================="
echo "    Repository:                $FRIENDLY_CHECKOUT_PATH"
echo "    Changes between branches:  $REMOTE_BROWSER_UPSTREAM/$BASE_BRANCH..$CURRENT_BRANCH"
echo "    BASE_REVISION:             $NEW_BASE_REVISION_TEXT"
echo "    BUILD_NUMBER:              $YEL$BUILD_NUMBER (changed)$END"
echo "=============================================================="
echo
