#!/bin/bash

set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

PW_VERSION=$(node -e 'console.log(require("../../package.json").version)')
RELEASE_CHANNEL="$1"
if [[ "${RELEASE_CHANNEL}" == "stable" ]]; then
  if [[ "${PW_VERSION}" == *-* ]]; then
    echo "ERROR: cannot publish stable docker with Playwright version '${PW_VERSION}'"
    exit 1
  fi
elif [[ "${RELEASE_CHANNEL}" == "canary" ]]; then
  if [[ "${PW_VERSION}" != *-* ]]; then
    echo "ERROR: cannot publish canary docker with Playwright version '${PW_VERSION}'"
    exit 1
  fi
else
  echo "ERROR: unknown release channel - ${RELEASE_CHANNEL}"
  echo "Must be either 'stable' or 'canary'"
  exit 1
fi

if [[ -z "${GITHUB_SHA}" ]]; then
  echo "ERROR: GITHUB_SHA env variable must be specified"
  exit 1
fi

BIONIC_TAGS=(
  "next-bionic"
  "v${PW_VERSION}-bionic"
)
if [[ "$RELEASE_CHANNEL" == "stable" ]]; then
  BIONIC_TAGS+=("bionic")
fi

FOCAL_TAGS=(
  "next"
  "sha-${GITHUB_SHA}"
  "next-focal"
  "v${PW_VERSION}-focal"
  "v${PW_VERSION}"
)

if [[ "$RELEASE_CHANNEL" == "stable" ]]; then
  FOCAL_TAGS+=("latest")
  FOCAL_TAGS+=("focal")
fi

publish_docker_images_with_arch_suffix() {
  local FLAVOR="$1"
  local TAGS=()
  if [[ "$FLAVOR" == "bionic" ]]; then
    TAGS=("${BIONIC_TAGS[@]}")
  elif [[ "$FLAVOR" == "focal" ]]; then
    TAGS=("${FOCAL_TAGS[@]}")
  else
    echo "ERROR: unknown flavor - $FLAVOR. Must be either 'bionic' or 'focal'"
    exit 1
  fi
  local ARCH="$2"
  if [[ "$ARCH" != "amd64" && "$ARCH" != "arm64" ]]; then
    echo "ERROR: unknown arch - $ARCH. Must be either 'amd64' or 'arm64'"
    exit 1
  fi
  # Prune docker images to avoid platform conflicts
  docker system prune -fa
  ./build.sh "--${ARCH}" "${FLAVOR}" playwright:localbuild

  for ((i = 0; i < ${#TAGS[@]}; i++)) do
    local TAG="${TAGS[$i]}"
    ./tag_and_push.sh playwright:localbuild "playwright.azurecr.io/public/playwright:${TAG}-${ARCH}"
  done
}

publish_docker_manifest () {
  local FLAVOR="$1"
  local TAGS=()
  if [[ "$FLAVOR" == "bionic" ]]; then
    TAGS=("${BIONIC_TAGS[@]}")
  elif [[ "$FLAVOR" == "focal" ]]; then
    TAGS=("${FOCAL_TAGS[@]}")
  else
    echo "ERROR: unknown flavor - $FLAVOR. Must be either 'bionic' or 'focal'"
    exit 1
  fi

  for ((i = 0; i < ${#TAGS[@]}; i++)) do
    local TAG="${TAGS[$i]}"
    local BASE_IMAGE_TAG="playwright.azurecr.io/public/playwright:${TAG}"
    local IMAGE_NAMES=""
    if [[ "$2" == "arm64" || "$2" == "amd64" ]]; then
        IMAGE_NAMES="${IMAGE_NAMES} ${BASE_IMAGE_TAG}-$2"
    fi
    if [[ "$3" == "arm64" || "$3" == "amd64" ]]; then
        IMAGE_NAMES="${IMAGE_NAMES} ${BASE_IMAGE_TAG}-$3"
    fi
    docker manifest create "${BASE_IMAGE_TAG}" $IMAGE_NAMES
    docker manifest push "${BASE_IMAGE_TAG}"
  done
}

publish_docker_images_with_arch_suffix bionic amd64
publish_docker_manifest bionic amd64

publish_docker_images_with_arch_suffix focal amd64
publish_docker_images_with_arch_suffix focal arm64
publish_docker_manifest focal amd64 arm64
