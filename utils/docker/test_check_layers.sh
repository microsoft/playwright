#!/usr/bin/env bash
set -e
set +x

if [[ ($1 == '--help') || ($1 == '-h') ]]; then
  echo "usage: $(basename $0)"
  echo
  echo "Test check_layers.js with two small images that this script builds."
  echo
  exit 0
fi

# The images that we publish are clean, so a build never sees check_layers.js fail.
# This test gives it an image with a forbidden file, to know that it still finds one.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
TMP_DIR="$(mktemp -d)"

function cleanup() {
  rm -rf "${TMP_DIR}"
  docker rmi -f playwright:check-layers-bad playwright:check-layers-good > /dev/null 2>&1 || true
}
trap cleanup EXIT

cd "${TMP_DIR}"
echo "placeholder" > file

# 1. A .npmrc in a lower layer must fail the check.
cat > Dockerfile.bad <<'DOCKERFILE'
FROM scratch
COPY file /root/.npmrc
COPY file /readme
DOCKERFILE
docker build -q -t playwright:check-layers-bad -f Dockerfile.bad . > /dev/null
if node "${SCRIPT_DIR}/check_layers.js" playwright:check-layers-bad > output.txt 2>&1; then
  cat output.txt
  echo "FAILED: check_layers.js passed for an image with /root/.npmrc in a layer"
  exit 1
fi
# The check must fail because it found the file, not because it crashed.
if ! grep -q '^  root/\.npmrc$' output.txt; then
  cat output.txt
  echo "FAILED: check_layers.js did not report root/.npmrc"
  exit 1
fi

# 2. An image with only allowed files must pass the check.
cat > Dockerfile.good <<'DOCKERFILE'
FROM scratch
COPY file /usr/local/lib/node_modules/npm/.npmrc
COPY file /readme
DOCKERFILE
docker build -q -t playwright:check-layers-good -f Dockerfile.good . > /dev/null
if ! node "${SCRIPT_DIR}/check_layers.js" playwright:check-layers-good > output.txt 2>&1; then
  cat output.txt
  echo "FAILED: check_layers.js failed for an image with no forbidden files"
  exit 1
fi

echo "PASSED: check_layers.js finds a forbidden file and accepts a clean image"
