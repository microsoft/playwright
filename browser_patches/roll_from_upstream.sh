#!/usr/bin/env bash
# A script to roll browser patches from the repositories where the browsers are built.

set -e
set +x

if [[ "$#" -lt 1 || "$#" -gt 2 ]]; then
  echo "Usage: $0 <path to checkout> [firefox|webkit|winldd]"
  echo
  echo "  firefox, winldd  <path to checkout> is a playwright-browsers checkout."
  echo "  webkit           <path to checkout> is a playwright-webkit checkout. The patch is"
  echo "                   generated from its HEAD commit."
  echo "  no filter        <path to checkout> is a playwright-browsers checkout. Rolls"
  echo "                   firefox and winldd."
  exit 1
fi

if ! [[ -d "$1" ]]; then
  echo "ERROR: the source directory $1 does not exist"
  exit 1
fi

SOURCE_DIRECTORY="$(cd "$1" && pwd -P)"
FILTER="${2:-}"

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

SCRIPT_PATH=$(pwd -P)

# WebKit is developed in playwright-webkit as commits on top of upstream WebKit, not as
# patch files. Generate the files of ./webkit from the HEAD commit of that checkout.
roll_webkit() {
  # On CI, the checkout directory can have an arbitrary name, so detect the checkout by
  # a marker file instead of the directory name.
  if ! [[ -f "${SOURCE_DIRECTORY}/playwright/series.sh" ]]; then
    echo "ERROR: ${SOURCE_DIRECTORY} does not look like a playwright-webkit checkout"
    exit 1
  fi
  # series.sh knows where the Playwright commits start and which files are not WebKit sources.
  source "${SOURCE_DIRECTORY}/playwright/series.sh"
  local upstream
  upstream=$(cd "${SOURCE_DIRECTORY}" && series_upstream HEAD)

  # The patch has the changes to WebKit sources. The embedder is exported as a folder, and
  # the build scripts, the CI and the docs of playwright-webkit are not a part of the patch.
  local not_webkit_re="^Tools/Playwright/|${SERIES_TOOLING_FILES_RE}|${SERIES_CONFIG_FILES_RE}|${UPSTREAM_FILES_RE}"
  local patched_files=()
  local file
  while IFS= read -r -d '' file; do
    if ! [[ "${file}" =~ ${not_webkit_re} ]]; then
      patched_files+=("${file}")
    fi
  done < <(git -C "${SOURCE_DIRECTORY}" diff --no-renames --name-only -z "${upstream}" HEAD)
  if [[ "${#patched_files[@]}" -eq 0 ]]; then
    echo "ERROR: no changes to WebKit sources between ${upstream} and HEAD of ${SOURCE_DIRECTORY}"
    exit 1
  fi

  mkdir -p "${SCRIPT_PATH}/webkit/patches"
  git -C "${SOURCE_DIRECTORY}" --literal-pathspecs diff --no-renames --diff-algorithm=myers --full-index \
      "${upstream}" HEAD -- "${patched_files[@]}" > "${SCRIPT_PATH}/webkit/patches/bootstrap.diff"

  rm -rf "${SCRIPT_PATH}/webkit/embedder/Playwright"
  mkdir -p "${SCRIPT_PATH}/webkit/embedder"
  git -C "${SOURCE_DIRECTORY}" archive HEAD Tools/Playwright | tar -x -C "${SCRIPT_PATH}/webkit/embedder" --strip-components=1

  git -C "${SOURCE_DIRECTORY}" show HEAD:playwright/pw_run.sh > "${SCRIPT_PATH}/webkit/pw_run.sh"
  chmod +x "${SCRIPT_PATH}/webkit/pw_run.sh"

  {
    echo 'REMOTE_URL="https://github.com/WebKit/WebKit.git"'
    echo 'BASE_BRANCH="main"'
    echo "BASE_REVISION=\"${upstream}\""
  } > "${SCRIPT_PATH}/webkit/UPSTREAM_CONFIG.sh"
  echo "Rolled webkit patches from $(git -C "${SOURCE_DIRECTORY}" rev-parse HEAD), based on upstream ${upstream}"
}

if [[ "${FILTER}" == "webkit" ]]; then
  roll_webkit
  exit 0
fi

# On CI, the playwright-browsers checkout directory can have an arbitrary name,
# so detect the checkout by a marker file instead of the directory name.
if ! [[ -f "${SOURCE_DIRECTORY}/browser_patches/build_flavors.sh" ]]; then
  echo "ERROR: ${SOURCE_DIRECTORY} does not look like a playwright-browsers checkout"
  exit 1
fi

firefox_files=(
  "./firefox/juggler/"
  "./firefox/patches/"
  "./firefox/preferences/"
  "./firefox/UPSTREAM_CONFIG.sh"
)

winldd_files=(
  "./winldd/"
)

case "${FILTER}" in
  firefox)
    files=("${firefox_files[@]}")
    ;;
  winldd)
    files=("${winldd_files[@]}")
    ;;
  "")
    files=("${firefox_files[@]}" "${winldd_files[@]}")
    ;;
  *)
    echo "ERROR: unknown filter '${FILTER}'; supported filters: firefox, webkit, winldd"
    exit 1
    ;;
esac

for file in "${files[@]}"; do
  rsync -av --delete "${SOURCE_DIRECTORY}/browser_patches/${file}" "${SCRIPT_PATH}/${file}"
done
