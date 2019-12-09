#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

REMOTE_BROWSER_UPSTREAM="browser_upstream"
BUILD_BRANCH="playwright-build"

if [[ ($1 == '--help') || ($1 == '-h') ]]; then
  echo "usage: $(basename $0) [firefox|webkit] [custom_checkout_path]"
  echo
  echo "Prepares browser checkout. The checkout is a GIT repository that:"
  echo "- has a '$REMOTE_BROWSER_UPSTREAM' remote pointing to a REMOTE_URL from UPSTREAM_CONFIG.sh"
  echo "- has a '$BUILD_BRANCH' branch that is BASE_REVISION with all the patches applied."
  echo
  echo "You can optionally specify custom_checkout_path if you want to use some other browser checkout"
  echo
  exit 0
fi

if [[ $# == 0 ]]; then
  echo "missing browser: 'firefox' or 'webkit'"
  echo "try './$(basename $0) --help' for more information"
  exit 1
fi

# FRIENDLY_CHECKOUT_PATH is used only for logging.
FRIENDLY_CHECKOUT_PATH="";
CHECKOUT_PATH=""
PATCHES_PATH=""
BUILD_NUMBER=""
if [[ ("$1" == "firefox") || ("$1" == "firefox/") ]]; then
  FRIENDLY_CHECKOUT_PATH="//browser_patches/firefox/checkout";
  CHECKOUT_PATH="$PWD/firefox/checkout"
  PATCHES_PATH="$PWD/firefox/patches"
  BUILD_NUMBER=$(cat "$PWD/firefox/BUILD_NUMBER")
  source "./firefox/UPSTREAM_CONFIG.sh"
elif [[ ("$1" == "webkit") || ("$1" == "webkit/") ]]; then
  FRIENDLY_CHECKOUT_PATH="//browser_patches/webkit/checkout";
  CHECKOUT_PATH="$PWD/webkit/checkout"
  PATCHES_PATH="$PWD/webkit/patches"
  BUILD_NUMBER=$(cat "$PWD/webkit/BUILD_NUMBER")
  source "./webkit/UPSTREAM_CONFIG.sh"
else
  echo ERROR: unknown browser - "$1"
  exit 1
fi

# we will use this just for beauty.
if [[ $# == 2 ]]; then
  echo "WARNING: using custom checkout path $CHECKOUT_PATH"
  CHECKOUT_PATH=$2
  FRIENDLY_CHECKOUT_PATH="<custom_checkout('$2')>"
fi

# if there's no checkout folder - checkout one.
if ! [[ -d $CHECKOUT_PATH ]]; then
  echo "-- $FRIENDLY_CHECKOUT_PATH is missing - checking out.."
  git clone --single-branch --branch $BASE_BRANCH $REMOTE_URL $CHECKOUT_PATH
else
  echo "-- checking $FRIENDLY_CHECKOUT_PATH folder - OK"
fi

# if folder exists but not a git repository - bail out.
if ! [[ -d $CHECKOUT_PATH/.git ]]; then
  echo "ERROR: $FRIENDLY_CHECKOUT_PATH is not a git repository! Remove it and re-run the script."
  exit 1
else
  echo "-- checking $FRIENDLY_CHECKOUT_PATH is a git repo - OK"
fi

# ============== SETTING UP GIT REPOSITORY ==============
cd $CHECKOUT_PATH

# Bail out if git repo is dirty.
if [[ -n $(git status -s --untracked-files=no) ]]; then
  echo "ERROR: $FRIENDLY_CHECKOUT_PATH has dirty GIT state - commit everything and re-run the script."
  exit 1
fi

# Setting up |$REMOTE_BROWSER_UPSTREAM| remote and fetch the $BASE_BRANCH
if git remote get-url $REMOTE_BROWSER_UPSTREAM >/dev/null; then
  echo "-- setting |$REMOTE_BROWSER_UPSTREAM| remote url to $REMOTE_URL"
  git remote set-url $REMOTE_BROWSER_UPSTREAM $REMOTE_URL
else
  echo "-- adding |$REMOTE_BROWSER_UPSTREAM| remote to $REMOTE_URL"
  git remote add $REMOTE_BROWSER_UPSTREAM $REMOTE_URL
fi

# Check if we have the $BASE_REVISION commit in GIT
if ! git cat-file -e $BASE_REVISION^{commit}; then
  # If not, fetch from REMOTE_BROWSER_UPSTREAM and check one more time.
  git fetch $REMOTE_BROWSER_UPSTREAM $BASE_BRANCH
  if ! git cat-file -e $BASE_REVISION^{commit}; then
    echo "ERROR: $FRIENDLY_CHECKOUT_PATH/ does not include the BASE_REVISION (@$BASE_REVISION). Wrong revision number?"
    exit 1
  fi
fi
echo "-- checking $FRIENDLY_CHECKOUT_PATH repo has BASE_REVISION (@$BASE_REVISION) commit - OK"

# Check out the $BASE_REVISION
git checkout $BASE_REVISION

# Create a playwright-build branch and apply all the patches to it.
if git show-ref --verify --quiet refs/heads/playwright-build; then
  git branch -D playwright-build
fi
git checkout -b playwright-build
echo "-- applying patches"
git apply --index $PATCHES_PATH/*
git commit -a --author="playwright-devops <devops@playwright.com>" -m "chore: bootstrap build #$BUILD_NUMBER"

echo
echo
echo "DONE. Browser is ready to be built."
