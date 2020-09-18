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
WEBKIT_EXTRA_FOLDER_PATH=""
FIREFOX_EXTRA_FOLDER_PATH=""
if [[ ("$1" == "chromium") || ("$1" == "chromium/") || ("$1" == "cr") ]]; then
  echo "FYI: chromium checkout is not supported. Use '//browser_patches/chromium/build.sh' instead"
  exit 0
elif [[ ("$1" == "ffmpeg") || ("$1" == "ffmpeg/") ]]; then
  echo "FYI: ffmpeg checkout is not supported. Use '//browser_patches/ffmpeg/build.sh' instead"
  exit 0
elif [[ ("$1" == "winldd") || ("$1" == "winldd/") ]]; then
  echo "FYI: winldd source code is available right away"
  exit 0
elif [[ ("$1" == "firefox") || ("$1" == "firefox/") || ("$1" == "ff") ]]; then
  FRIENDLY_CHECKOUT_PATH="//browser_patches/firefox/checkout";
  CHECKOUT_PATH="$PWD/firefox/checkout"
  PATCHES_PATH="$PWD/firefox/patches"
  FIREFOX_EXTRA_FOLDER_PATH="$PWD/firefox/juggler"
  BUILD_NUMBER=$(head -1 "$PWD/firefox/BUILD_NUMBER")
  source "./firefox/UPSTREAM_CONFIG.sh"
elif [[ ("$1" == "webkit") || ("$1" == "webkit/") || ("$1" == "wk") ]]; then
  FRIENDLY_CHECKOUT_PATH="//browser_patches/webkit/checkout";
  CHECKOUT_PATH="$PWD/webkit/checkout"
  PATCHES_PATH="$PWD/webkit/patches"
  WEBKIT_EXTRA_FOLDER_PATH="$PWD/webkit/embedder/Playwright"
  BUILD_NUMBER=$(head -1 "$PWD/webkit/BUILD_NUMBER")
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

# If not, fetch from REMOTE_BROWSER_UPSTREAM and check one more time.
git fetch $REMOTE_BROWSER_UPSTREAM $BASE_BRANCH
if ! git cat-file -e $BASE_REVISION^{commit}; then
  echo "ERROR: $FRIENDLY_CHECKOUT_PATH/ does not include the BASE_REVISION (@$BASE_REVISION). Wrong revision number?"
  exit 1
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
git apply --index --whitespace=nowarn $PATCHES_PATH/*

if [[ ! -z "${WEBKIT_EXTRA_FOLDER_PATH}" ]]; then
  echo "-- adding WebKit embedders"
  cp -r "${WEBKIT_EXTRA_FOLDER_PATH}" ./Tools/Playwright
  git add Tools/Playwright
elif [[ ! -z "${FIREFOX_EXTRA_FOLDER_PATH}" ]]; then
  echo "-- adding juggler"
  cp -r "${FIREFOX_EXTRA_FOLDER_PATH}" ./juggler
  git add juggler
fi

git commit -a --author="playwright-devops <devops@playwright.dev>" -m "chore: bootstrap build #$BUILD_NUMBER"

echo
echo
echo "DONE. Browser is ready to be built."
