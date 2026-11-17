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
# This test gives it an image with forbidden files, to know that it still finds them.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
TMP_DIR="$(mktemp -d)"

function cleanup() {
  rm -rf "${TMP_DIR}"
  docker rmi -f playwright:check-layers-bad playwright:check-layers-good > /dev/null 2>&1 || true
}
trap cleanup EXIT

cd "${TMP_DIR}"
echo "placeholder" > file

# 1. Forbidden files in a lower layer must fail the check.
FORBIDDEN_FILES=(
  root/.npm/_cacache/index-v5/aa/bb/cc
  root/.npm/_logs/2026-01-01T00_00_00_000Z-debug-0.log
  tmp/node-compile-cache/v26.0.0-x64/aabbcc
  root/.yarn/berry/cache/a.zip
  root/.m2/repository/com/example/a/1.0/a-1.0.jar
  root/.cache/pip/http-v2/a/b/c
  home/pwuser/.cache/virtualenv/a
  src/.git/config
)
echo "FROM scratch" > Dockerfile.bad
for FORBIDDEN_FILE in "${FORBIDDEN_FILES[@]}"; do
  echo "COPY file /${FORBIDDEN_FILE}" >> Dockerfile.bad
done
echo "COPY file /readme" >> Dockerfile.bad
docker build -q -t playwright:check-layers-bad -f Dockerfile.bad . > /dev/null
if node "${SCRIPT_DIR}/check_layers.js" playwright:check-layers-bad > output.txt 2>&1; then
  cat output.txt
  echo "FAILED: check_layers.js passed for an image with forbidden files in its layers"
  exit 1
fi
# The check must fail because it found the files, not because it crashed.
for FORBIDDEN_FILE in "${FORBIDDEN_FILES[@]}"; do
  if ! grep -q -x -F "  ${FORBIDDEN_FILE}" output.txt; then
    cat output.txt
    echo "FAILED: check_layers.js did not report ${FORBIDDEN_FILE}"
    exit 1
  fi
done

# 2. An image with no forbidden files must pass the check. Files that can hold
#    a secret, such as .npmrc, pass too: the Trivy scan looks for secrets.
cat > Dockerfile.good <<'DOCKERFILE'
FROM scratch
COPY file /usr/local/lib/node_modules/npm/.npmrc
COPY file /etc/ssl/certs/ca.pem
COPY file /var/cache/fontconfig/aabbcc.cache-9
COPY file /readme
DOCKERFILE
docker build -q -t playwright:check-layers-good -f Dockerfile.good . > /dev/null
if ! node "${SCRIPT_DIR}/check_layers.js" playwright:check-layers-good > output.txt 2>&1; then
  cat output.txt
  echo "FAILED: check_layers.js failed for an image with no forbidden files"
  exit 1
fi

echo "PASSED: check_layers.js finds forbidden files and accepts a clean image"
