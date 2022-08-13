#!/bin/bash
# This script is designed to build Firefox & WebKit on various Linux
# distributions inside docker containers.
set -e
set +x
set -o pipefail

if [[ ($1 == '--help') || ($1 == '-h') ]]; then
  echo "usage: $(basename "$0") [webkit-ubuntu-20.04|firefox-debian-11|...] [build|test|compile|enter|stop]"
  echo
  echo "Builds Webkit or Firefox browser inside given Linux distribution"
  exit 0
fi

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"
SCRIPT_FOLDER="$(pwd -P)"

export BUILD_FLAVOR="${1}"
export BROWSER_NAME=""

DOCKERFILE=""

if [[ "${BUILD_FLAVOR}" == "firefox-beta-"* ]]; then
  DOCKERFILE="${SCRIPT_FOLDER}/firefox-beta/${BUILD_FLAVOR#firefox-beta-}.dockerfile"
  BROWSER_NAME="firefox-beta"
elif [[ "${BUILD_FLAVOR}" == "firefox-"* ]]; then
  DOCKERFILE="${SCRIPT_FOLDER}/firefox/${BUILD_FLAVOR#firefox-}.dockerfile"
  BROWSER_NAME="firefox"
elif [[ "${BUILD_FLAVOR}" == "webkit-"* ]]; then
  DOCKERFILE="${SCRIPT_FOLDER}/webkit/${BUILD_FLAVOR#webkit-}.dockerfile"
  BROWSER_NAME="webkit"
else
  echo "ERROR: unknown build flavor - ${BUILD_FLAVOR}"
  exit 1
fi

if [[ "${BUILD_FLAVOR}" == *"-arm64" ]]; then
  EXPECTED_ARCH="arm64"
  DOCKER_PLATFORM="linux/arm64"
else
  EXPECTED_ARCH="x86_64"
  DOCKER_PLATFORM="linux/amd64"
fi

if [[ $(arch) != "${EXPECTED_ARCH}" ]]; then
  echo "ERROR: host architecture $(arch) does not match expected architecture - ${EXPECTED_ARCH}"
  exit 1
fi

DOCKER_IMAGE_NAME="${BUILD_FLAVOR}"
DOCKER_CONTAINER_NAME="${BUILD_FLAVOR}"
DOCKER_ARGS=$(echo \
  --env CI \
  --env BUILD_FLAVOR \
  --env BROWSER_NAME \
  --env TELEGRAM_BOT_KEY \
  --env AZ_ACCOUNT_NAME \
  --env AZ_ACCOUNT_KEY \
  --env GITHUB_SERVER_URL \
  --env GITHUB_REPOSITORY \
  --env GITHUB_RUN_ID \
  --env GH_TOKEN \
  --env DEBIAN_FRONTEND=noninteractive \
  --env TZ="America/Los_Angeles"
)

if [[ "$2" == "build" ]]; then
  docker build \
    --build-arg ARG_BUILD_FLAVOR="${BUILD_FLAVOR}" \
    --build-arg ARG_BROWSER_NAME="${BROWSER_NAME}" \
    --no-cache \
    --platform "${DOCKER_PLATFORM}" \
    -t "${DOCKER_IMAGE_NAME}" \
    -f "${DOCKERFILE}" .
elif [[ "$2" == "test" ]]; then
  docker run --rm ${DOCKER_ARGS} --init --name "${DOCKER_CONTAINER_NAME}" --platform "${DOCKER_PLATFORM}" -it "${DOCKER_IMAGE_NAME}" /bin/bash -c '
    CI=1 ./browser_patches/prepare_checkout.sh "${BROWSER_NAME}"
    ./browser_patches/build.sh "${BROWSER_NAME}" --full
    ./browser_patches/${BROWSER_NAME}/archive.sh $PWD/archive.zip
  '
elif [[ "$2" == "compile" ]]; then
  docker run --rm ${DOCKER_ARGS} --init --name "${DOCKER_CONTAINER_NAME}" --platform "${DOCKER_PLATFORM}" -t "${DOCKER_IMAGE_NAME}" /bin/bash -c '
    ./browser_patches/checkout_build_archive_upload.sh "${BUILD_FLAVOR}"
  '
elif [[ "$2" == "enter" ]]; then
  docker run --rm ${DOCKER_ARGS} --init --name "${DOCKER_CONTAINER_NAME}" --platform "${DOCKER_PLATFORM}" -it "${DOCKER_IMAGE_NAME}" /bin/bash
elif [[ "$2" == "kill" || "$2" == "stop" ]]; then
  docker kill "${DOCKER_CONTAINER_NAME}"
  # Wait for container to stop
  docker wait "${DOCKER_CONTAINER_NAME}" || true
else
  echo "ERROR: unknown command - $2"
  exit 1
fi

