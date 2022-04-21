#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"
SCRIPT_FOLDER=$(pwd -P)

# 1. get current version
CURRENT_BETA_VERSION=$(curl https://omahaproxy.appspot.com/all | grep "win64,canary," | cut -d ',' -f 3)
VERSION_INFO_JSON=$(curl "https://omahaproxy.appspot.com/deps.json?version=$CURRENT_BETA_VERSION")

NODE_SCRIPT=$(cat <<EOF
const json = JSON.parse(fs.readFileSync(0));
console.log([
  '#      CURRENT_VERSION: ' + json.chromium_version,
  '# BRANCH_BASE_POSITION: ' + json.chromium_base_position,
  'BRANCH_COMMIT="' + json.chromium_base_commit + '"',
].join('\n'));
EOF
)
NEW_CONFIG=$(echo "${VERSION_INFO_JSON}" | node -e "${NODE_SCRIPT}")
CURRENT_CONFIG=$(cat "${SCRIPT_FOLDER}/UPSTREAM_CONFIG.sh")

if [[ "${CURRENT_CONFIG}" == "${NEW_CONFIG}" ]]; then
  echo "No changes!"
  exit 0
fi

echo "${NEW_CONFIG}" > "${SCRIPT_FOLDER}/UPSTREAM_CONFIG.sh"
BUILD_NUMBER=$(cat "${SCRIPT_FOLDER}/BUILD_NUMBER")
echo $(( $BUILD_NUMBER + 1 )) > "${SCRIPT_FOLDER}/BUILD_NUMBER"
