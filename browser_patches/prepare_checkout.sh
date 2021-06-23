#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"
SCRIPT_PATH=$(pwd -P)

REMOTE_BROWSER_UPSTREAM="browser_upstream"
BUILD_BRANCH="playwright-build"

if [[ ($1 == '--help') || ($1 == '-h') ]]; then
  echo "usage: $(basename $0) [firefox|firefox-beta|webkit] [custom_checkout_path]"
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

function prepare_chromium_checkout {
  cd "${SCRIPT_PATH}"

  source "${SCRIPT_PATH}/chromium/ensure_depot_tools.sh"

  if [[ -z "${CR_CHECKOUT_PATH}" ]]; then
    echo "ERROR: chromium compilation requires CR_CHECKOUT_PATH to be set to reuse checkout."
    echo "NOTE: we expect '\$CR_CHECKOUT_PATH/src' to exist to be a valid chromium checkout."
    exit 1
  fi

  # Get chromium SHA from the build revision.
  # This will get us the last redirect URL from the crrev.com service.
  CRREV=$(head -1 ./chromium/BUILD_NUMBER)
  REVISION_URL=$(curl -ILs -o /dev/null -w %{url_effective} "https://crrev.com/${CRREV}")
  CRSHA="${REVISION_URL##*/}"

  # Update Chromium checkout.
  #
  # This is based on https://chromium.googlesource.com/chromium/src/+/master/docs/linux/build_instructions.md#get-the-code
  if [[ ! -d "${CR_CHECKOUT_PATH}/src" ]]; then
    rm -rf "${CR_CHECKOUT_PATH}"
    mkdir -p "${CR_CHECKOUT_PATH}"
    cd "${CR_CHECKOUT_PATH}"
    fetch --nohooks chromium
    cd src
    if [[ $(uname) == "Linux" ]]; then
      ./build/install-build-deps.sh
    fi
    gclient runhooks
  fi
  cd "${CR_CHECKOUT_PATH}/src"
  git checkout master
  git pull origin master
  git checkout "${CRSHA}"
  gclient sync -D
}

# FRIENDLY_CHECKOUT_PATH is used only for logging.
FRIENDLY_CHECKOUT_PATH="";
CHECKOUT_PATH=""
PATCHES_PATH=""
BUILD_NUMBER=""
WEBKIT_EXTRA_FOLDER_PATH=""
FIREFOX_EXTRA_FOLDER_PATH=""
if [[ ("$1" == "chromium") || ("$1" == "chromium/") || ("$1" == "cr") ]]; then
  prepare_chromium_checkout
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
  if [[ ! -z "${FF_CHECKOUT_PATH}" ]]; then
    echo "WARNING: using checkout path from FF_CHECKOUT_PATH env: ${FF_CHECKOUT_PATH}"
    CHECKOUT_PATH="${FF_CHECKOUT_PATH}"
    FRIENDLY_CHECKOUT_PATH="<FF_CHECKOUT_PATH>"
  fi
elif [[ ("$1" == "firefox-beta") || ("$1" == "ff-beta") ]]; then
  # NOTE: firefox-beta re-uses firefox checkout.
  FRIENDLY_CHECKOUT_PATH="//browser_patches/firefox/checkout";
  CHECKOUT_PATH="$PWD/firefox/checkout"

  PATCHES_PATH="$PWD/firefox-beta/patches"
  FIREFOX_EXTRA_FOLDER_PATH="$PWD/firefox-beta/juggler"
  BUILD_NUMBER=$(head -1 "$PWD/firefox-beta/BUILD_NUMBER")
  source "./firefox-beta/UPSTREAM_CONFIG.sh"
  if [[ ! -z "${FF_CHECKOUT_PATH}" ]]; then
    echo "WARNING: using checkout path from FF_CHECKOUT_PATH env: ${FF_CHECKOUT_PATH}"
    CHECKOUT_PATH="${FF_CHECKOUT_PATH}"
    FRIENDLY_CHECKOUT_PATH="<FF_CHECKOUT_PATH>"
  fi
elif [[ ("$1" == "deprecated-webkit-mac-10.14") ]]; then
  echo "FYI: deprecated-webkit-mac-10.14 has no checkout anymore"
  exit 0
elif [[ ("$1" == "webkit") || ("$1" == "webkit/") || ("$1" == "wk") ]]; then
  FRIENDLY_CHECKOUT_PATH="//browser_patches/webkit/checkout";
  CHECKOUT_PATH="$PWD/webkit/checkout"
  PATCHES_PATH="$PWD/webkit/patches"
  WEBKIT_EXTRA_FOLDER_PATH="$PWD/webkit/embedder/Playwright"
  BUILD_NUMBER=$(head -1 "$PWD/webkit/BUILD_NUMBER")
  source "./webkit/UPSTREAM_CONFIG.sh"
  if [[ ! -z "${WK_CHECKOUT_PATH}" ]]; then
    echo "WARNING: using checkout path from WK_CHECKOUT_PATH env: ${WK_CHECKOUT_PATH}"
    CHECKOUT_PATH="${WK_CHECKOUT_PATH}"
    FRIENDLY_CHECKOUT_PATH="<WK_CHECKOUT_PATH>"
  fi
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
  if [[ -n "$CI" ]]; then
    # In CI environment, we re-checkout constantly, so we do a shallow checkout to save time.
    git clone --single-branch --depth 1 --branch $BASE_BRANCH $REMOTE_URL $CHECKOUT_PATH
  else
    # In non-CI environment, do a full checkout. This takes time,
    # but liberates from the `git fetch --unshallow`.
    git clone --single-branch --branch $BASE_BRANCH $REMOTE_URL $CHECKOUT_PATH
  fi
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
  git fetch --depth 1 $REMOTE_BROWSER_UPSTREAM $BASE_BRANCH
fi

# Check if our checkout contains BASE_REVISION.
# If not, fetch from REMOTE_BROWSER_UPSTREAM and slowly fetch more and more commits
# until we find $BASE_REVISION.
# This technique allows us start with a shallow clone.
if ! git cat-file -e $BASE_REVISION^{commit} 2>/dev/null; then
  # Detach git head so that we can fetch into branch.
  git checkout --detach >/dev/null 2>/dev/null

  # Fetch 128 commits first, and then double the amount every iteration.
  FETCH_DEPTH=128
  SUCCESS="no"
  while (( FETCH_DEPTH <= 8192 )); do
    echo "Fetching ${FETCH_DEPTH} commits to find base revision..."
    git fetch --depth "${FETCH_DEPTH}" $REMOTE_BROWSER_UPSTREAM $BASE_BRANCH
    FETCH_DEPTH=$(( FETCH_DEPTH * 2 ));
    if git cat-file -e $BASE_REVISION^{commit} >/dev/null; then
      SUCCESS="yes"
      break;
    fi
  done
  if [[ "${SUCCESS}" == "no" ]]; then
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
git apply --index --whitespace=nowarn $PATCHES_PATH/*

if [[ ! -z "${WEBKIT_EXTRA_FOLDER_PATH}" ]]; then
  echo "-- adding WebKit embedders"
  EMBEDDER_DIR="$PWD/Tools/Playwright"
  # git status does not show empty directories, check it separately.
  if [[ -d $EMBEDDER_DIR ]]; then
    echo "ERROR: $EMBEDDER_DIR already exists! Remove it and re-run the script."
    exit 1
  fi
  cp -r "${WEBKIT_EXTRA_FOLDER_PATH}" $EMBEDDER_DIR
  git add $EMBEDDER_DIR
elif [[ ! -z "${FIREFOX_EXTRA_FOLDER_PATH}" ]]; then
  echo "-- adding juggler"
  EMBEDDER_DIR="$PWD/juggler"
  # git status does not show empty directories, check it separately.
  if [[ -d $EMBEDDER_DIR ]]; then
    echo "ERROR: $EMBEDDER_DIR already exists! Remove it and re-run the script."
    exit 1
  fi
  cp -r "${FIREFOX_EXTRA_FOLDER_PATH}" $EMBEDDER_DIR
  git add $EMBEDDER_DIR
fi

git commit -a --author="playwright-devops <devops@playwright.dev>" -m "chore($1): bootstrap build #$BUILD_NUMBER"

echo
echo
echo "DONE. Browser is ready to be built."
