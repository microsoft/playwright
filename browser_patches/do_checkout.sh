#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

if [[ ($1 == '--help') || ($1 == '-h') ]]; then
  echo "usage: $(basename $0) [firefox|webkit]"
  echo
  echo "Produces a browser checkout ready to be built."
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
# Export path is where we put the patches and BASE_REVISION
REMOTE_URL=""
BASE_BRANCH=""
if [[ ("$1" == "firefox") || ("$1" == "firefox/") ]]; then
  # we always apply our patches atop of beta since it seems to get better
  # reliability guarantees.
  BASE_BRANCH="beta"
  FRIENDLY_CHECKOUT_PATH="//browser_patches/firefox/checkout";
  CHECKOUT_PATH="$PWD/firefox/checkout"
  REMOTE_URL="https://github.com/mozilla/gecko-dev"
elif [[ ("$1" == "webkit") || ("$1" == "webkit/") ]]; then
  # webkit has only a master branch.
  BASE_BRANCH="master"
  FRIENDLY_CHECKOUT_PATH="//browser_patches/webkit/checkout";
  CHECKOUT_PATH="$PWD/webkit/checkout"
  REMOTE_URL=""
  REMOTE_URL="https://github.com/webkit/webkit"
else
  echo ERROR: unknown browser - "$1"
  exit 1
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

# Switch to git repository.
cd $CHECKOUT_PATH

# Check if git repo is dirty.
if [[ -n $(git status -s) ]]; then
  echo "ERROR: $FRIENDLY_CHECKOUT_PATH has dirty GIT state - commit everything and re-run the script."
  exit 1
fi

if [[ $(git config --get remote.origin.url) == "$REMOTE_URL" ]]; then
  echo "-- checking git origin url to point to $REMOTE_URL - OK";
else
  echo "ERROR: git origin url DOES NOT point to $REMOTE_URL. Remove $FRIENDLY_CHECKOUT_PATH and re-run the script.";
  exit 1
fi

# if there's no "BASE_BRANCH" branch - bail out.
if ! git show-ref --verify --quiet refs/heads/$BASE_BRANCH; then
  echo "ERROR: $FRIENDLY_CHECKOUT_PATH/ does not have '$BASE_BRANCH' branch! Remove checkout/ and re-run the script."
  exit 1
else
  echo "-- checking $FRIENDLY_CHECKOUT_PATH has 'beta' branch - OK"
fi

if ! [[ -z $(git log --oneline origin/$BASE_BRANCH..$BASE_BRANCH) ]]; then
  echo "ERROR: branch '$BASE_BRANCH' and branch 'origin/$BASE_BRANCH' have diverged - bailing out. Remove checkout/ and re-run the script."
  exit 1;
else
  echo "-- checking that $BASE_BRANCH and origin/$BASE_BRANCH are not diverged - OK"
fi

git checkout $BASE_BRANCH
git pull origin $BASE_BRANCH

PINNED_COMMIT=$(cat ../BASE_REVISION)
if ! git cat-file -e $PINNED_COMMIT^{commit}; then
  echo "ERROR: $FRIENDLY_CHECKOUT_PATH/ does not include the BASE_REVISION (@$PINNED_COMMIT). Remove checkout/ and re-run the script."
  exit 1
else
  echo "-- checking $FRIENDLY_CHECKOUT_PATH repo has BASE_REVISION (@$PINNED_COMMIT) commit - OK"
fi

# If there's already a PWDEV branch than we should check if it's fine to reset all changes
# to it.
if git show-ref --verify --quiet refs/heads/pwdev; then
  read -p "Do you want to reset 'PWDEV' branch? (ALL CHANGES WILL BE LOST) Y/n " -n 1 -r
  echo
  # if it's not fine to reset branch - bail out.
  if ! [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "If you want to keep the branch, than I can't do much! Bailing out!"
    exit 1
  else
    git checkout pwdev
    git reset --hard $PINNED_COMMIT
    echo "-- PWDEV now points to BASE_REVISION (@$PINNED_COMMIT)"
  fi
else
  # Otherwise just create a new branch.
  git checkout -b pwdev
  git reset --hard $PINNED_COMMIT
  echo "-- created 'pwdev' branch that points to BASE_REVISION (@$PINNED_COMMIT)."
fi

echo "-- applying all patches"
git am ../patches/*

echo
echo
echo "DONE. Browser is ready to be built."
