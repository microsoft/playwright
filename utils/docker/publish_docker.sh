#!/usr/bin/env bash

set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

MCR_IMAGE_NAME="playwright"
PW_VERSION=$(node ../../utils/workspace.js --get-version)

RELEASE_CHANNEL="$1"
if [[ "${RELEASE_CHANNEL}" == "stable" ]]; then
  if [[ "${PW_VERSION}" == *-* ]]; then
    echo "ERROR: cannot publish stable docker with Playwright version '${PW_VERSION}'"
    exit 1
  fi
else
  echo "ERROR: unknown release channel - ${RELEASE_CHANNEL}"
  echo "Must be either 'stable' or 'canary'"
  exit 1
fi

# Ubuntu 20.04
FOCAL_TAGS=(
  "v${PW_VERSION}-focal"
)

# Ubuntu 22.04
JAMMY_TAGS=(
  "v${PW_VERSION}-jammy"
)

# Ubuntu 24.04
NOBLE_TAGS=(
  "v${PW_VERSION}"
  "v${PW_VERSION}-noble"
)

tag_and_push() {
  local source="$1"
  local target="$2"
  echo "-- tagging: $target"
  docker tag $source $target
  docker push $target
  attach_eol_manifest $target
}

attach_eol_manifest() {
  local image="$1"
  local today=$(date -u +'%Y-%m-%d')
  install_oras_if_needed
  # oras is re-using Docker credentials, so we don't need to login.
  # Following the advice in https://portal.microsofticm.com/imp/v3/incidents/incident/476783820/summary
  ./oras/oras attach --artifact-type application/vnd.microsoft.artifact.lifecycle --annotation "vnd.microsoft.artifact.lifecycle.end-of-life.date=$today" $image
}

install_oras_if_needed() {
  if [[ -x oras/oras ]]; then
    return
  fi
  local version="1.1.0"
  curl -sLO "https://github.com/oras-project/oras/releases/download/v${version}/oras_${version}_linux_amd64.tar.gz"
  mkdir -p oras
  tar -zxf oras_${version}_linux_amd64.tar.gz -C oras
  rm oras_${version}_linux_amd64.tar.gz
}

publish_docker_images_with_arch_suffix() {
  local FLAVOR="$1"
  local TAGS=()
  if [[ "$FLAVOR" == "focal" ]]; then
    TAGS=("${FOCAL_TAGS[@]}")
  elif [[ "$FLAVOR" == "jammy" ]]; then
    TAGS=("${JAMMY_TAGS[@]}")
  elif [[ "$FLAVOR" == "noble" ]]; then
    TAGS=("${NOBLE_TAGS[@]}")
  else
    echo "ERROR: unknown flavor - $FLAVOR. Must be either 'focal', 'jammy', or 'noble'"
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
    tag_and_push playwright:localbuild "playwright.azurecr.io/public/${MCR_IMAGE_NAME}:${TAG}-${ARCH}"
  done
}

publish_docker_manifest () {
  local FLAVOR="$1"
  local TAGS=()
  if [[ "$FLAVOR" == "focal" ]]; then
    TAGS=("${FOCAL_TAGS[@]}")
  elif [[ "$FLAVOR" == "jammy" ]]; then
    TAGS=("${JAMMY_TAGS[@]}")
  elif [[ "$FLAVOR" == "noble" ]]; then
    TAGS=("${NOBLE_TAGS[@]}")
  else
    echo "ERROR: unknown flavor - $FLAVOR. Must be either 'focal', 'jammy', or 'noble'"
    exit 1
  fi

  for ((i = 0; i < ${#TAGS[@]}; i++)) do
    local TAG="${TAGS[$i]}"
    local BASE_IMAGE_TAG="playwright.azurecr.io/public/${MCR_IMAGE_NAME}:${TAG}"
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

# Ubuntu 20.04
publish_docker_images_with_arch_suffix focal amd64
publish_docker_images_with_arch_suffix focal arm64
publish_docker_manifest focal amd64 arm64

# Ubuntu 22.04
publish_docker_images_with_arch_suffix jammy amd64
publish_docker_images_with_arch_suffix jammy arm64
publish_docker_manifest jammy amd64 arm64

# Ubuntu 24.04
publish_docker_images_with_arch_suffix noble amd64
publish_docker_images_with_arch_suffix noble arm64
publish_docker_manifest noble amd64 arm64
