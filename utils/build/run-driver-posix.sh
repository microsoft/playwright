#!/usr/bin/env sh
# shellcheck disable=SC2164,SC3010,SC3020,SC3043

SCRIPT_PATH="$(cd "$(dirname "$0")" ; pwd -P)"

is_node_js_available() {
  local _full_path="${1}"

  "${_full_path}" -v &>/dev/null
  echo $?
}

# Test if the module Node.js works
# Especially important for NixOS ;)
nodejs="${SCRIPT_PATH}/node"
status_code=$(is_node_js_available "${nodejs}")

if [[ $status_code -ne 0 ]]; then
  # Test for available Node.js installation within the PATH variable
  nodejs="$(readlink -f "$(which "node" 2>/dev/null)")"
  status_code=$(is_node_js_available "${nodejs}")

  if [[ $status_code -ne 0 ]]; then
    echo "No usable Node.js version has been found!"
    echo "Goodbye"
    exit 1
  fi
fi

$nodejs "$SCRIPT_PATH/package/lib/cli/cli.js" "$@"
