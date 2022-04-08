# Since this script modifies PATH, it cannot be run in a subshell
# and must be sourced.
# Make sure it is sourced.
sourced=0
(return 0 2>/dev/null) && sourced=1 || sourced=0

if [[ $sourced == 0 ]]; then
  echo 'ERROR: cannot run this script in a subshell'
  echo 'This file modifies $PATH of the current shell, so it must be sourced instead'
  echo 'Use `source ensure_depot_tool.sh` instead'
  exit 1
fi

function ensure_depot_tools() {
  # Install depot_tools if they are not in system, and modify $PATH
  # to include depot_tools
  if ! command -v autoninja >/dev/null; then
    if [[ $(uname) == "MINGW"* || "$(uname)" == MSYS* ]]; then
      # NOTE: as of Feb 8, 2021, windows requires manual and separate
      # installation of depot_tools.
      echo "ERROR: cannot automatically install depot_tools on windows. Please, install manually"
      exit 1
    fi
    local SCRIPT_PATH=$(cd "$(dirname "$BASH_SOURCE")"; pwd -P)
    if [[ ! -d "${SCRIPT_PATH}/depot_tools" ]]; then
      git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git "${SCRIPT_PATH}/depot_tools"
    fi
    export PATH="${SCRIPT_PATH}/depot_tools:$PATH"
  fi
}

ensure_depot_tools
