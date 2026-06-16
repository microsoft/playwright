#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $(basename "$0") {jammy,noble,resolute} [amd64|arm64]"
  exit 1
fi

FLAVOR="$1"
ARCH="${2:-amd64}"

if [[ "$FLAVOR" != "jammy" && "$FLAVOR" != "noble" && "$FLAVOR" != "resolute" ]]; then
  echo "ERROR: unknown flavor '$FLAVOR' (expected jammy, noble, or resolute)"
  exit 1
fi

if [[ "$ARCH" != "amd64" && "$ARCH" != "arm64" ]]; then
  echo "ERROR: unknown arch '$ARCH' (expected amd64 or arm64)"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
IMAGE_TAG="playwright:localbuild-${FLAVOR}-${ARCH}"
CONTAINER_NAME="docker-tests-${FLAVOR}-${ARCH}"

cleanup() {
  docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
}

trap cleanup EXIT

cd "${ROOT_DIR}/utils/docker"
./build.sh "--${ARCH}" "${FLAVOR}" "${IMAGE_TAG}"

docker run \
  --rm \
  --name "${CONTAINER_NAME}" \
  --platform "linux/${ARCH}" \
  --user=pwuser \
  --workdir /home/pwuser \
  --env CI \
  --env INSIDE_DOCKER=1 \
  -v ~/.azure:/root/.azure \
  -d \
  -t \
  "${IMAGE_TAG}" /bin/bash

docker cp "${ROOT_DIR}" "${CONTAINER_NAME}:/home/pwuser/playwright"
docker exec --user root "${CONTAINER_NAME}" chown -R pwuser /home/pwuser/playwright
docker exec \
  --user root \
  --workdir /home/pwuser/playwright "${CONTAINER_NAME}" /bin/bash -c '
    git config --global --add safe.directory /home/pwuser/playwright
  '

docker exec --workdir /home/pwuser/playwright "${CONTAINER_NAME}" npm ci
docker exec --workdir /home/pwuser/playwright "${CONTAINER_NAME}" npm run build
docker exec --workdir /home/pwuser/playwright "${CONTAINER_NAME}" xvfb-run --auto-servernum --server-args="-screen 0 1280x960x24" npm run test -- --grep "@smoke"
