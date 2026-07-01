#!/usr/bin/env bash

set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

MCR_IMAGE_NAME="playwright"

RELEASE_CHANNEL="$1"
if [[ "${RELEASE_CHANNEL}" != "stable" && "${RELEASE_CHANNEL}" != "canary" ]]; then
  echo "ERROR: unknown release channel - '${RELEASE_CHANNEL}'"
  echo "Must be either 'stable' or 'canary'"
  exit 1
fi

MODE="$2"

# The version tag must be identical across the amd64, arm64 and manifest jobs so
# that the multi-arch manifest can find both arch-suffixed images. The CI computes
# it once (see the "Prepare" job) and passes it down via PW_DOCKER_VERSION_TAG.
if [[ -n "${PW_DOCKER_VERSION_TAG:-}" ]]; then
  VERSION_TAG="${PW_DOCKER_VERSION_TAG}"
else
  PW_VERSION=$(node ../../utils/workspace.js --get-version)
  if [[ "${RELEASE_CHANNEL}" == "stable" && "${PW_VERSION}" == *-* ]]; then
    echo "ERROR: cannot publish stable docker with Playwright version '${PW_VERSION}'"
    exit 1
  fi
  VERSION_TAG="v${PW_VERSION}"
  if [[ "${RELEASE_CHANNEL}" == "canary" ]]; then
    VERSION_TAG="v${PW_VERSION}-canary-$(date -u +'%Y%m%d%H%M%S')"
    echo "== CANARY build: publishing to ${VERSION_TAG}-* tags ==" >&2
  fi
fi

# Ubuntu 22.04
JAMMY_TAGS=(
  "${VERSION_TAG}-jammy"
)

# Ubuntu 24.04
NOBLE_TAGS=(
  "${VERSION_TAG}-noble"
)
if [[ "${RELEASE_CHANNEL}" == "stable" ]]; then
  NOBLE_TAGS+=("${VERSION_TAG}")
fi

# Ubuntu 26.04
RESOLUTE_TAGS=(
  "${VERSION_TAG}-resolute"
)

tags_for_flavor() {
  local FLAVOR="$1"
  if [[ "$FLAVOR" == "jammy" ]]; then
    echo "${JAMMY_TAGS[@]}"
  elif [[ "$FLAVOR" == "noble" ]]; then
    echo "${NOBLE_TAGS[@]}"
  elif [[ "$FLAVOR" == "resolute" ]]; then
    echo "${RESOLUTE_TAGS[@]}"
  else
    echo "ERROR: unknown flavor - $FLAVOR. Must be either 'jammy', 'noble', or 'resolute'" >&2
    exit 1
  fi
}

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
  local arch="amd64"
  if [[ "$(uname -m)" == "aarch64" || "$(uname -m)" == "arm64" ]]; then
    arch="arm64"
  fi
  curl -sLO "https://github.com/oras-project/oras/releases/download/v${version}/oras_${version}_linux_${arch}.tar.gz"
  mkdir -p oras
  tar -zxf oras_${version}_linux_${arch}.tar.gz -C oras
  rm oras_${version}_linux_${arch}.tar.gz
}

publish_docker_images_with_arch_suffix() {
  local FLAVOR="$1"
  local TAGS=($(tags_for_flavor "$FLAVOR"))
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
  local TAGS=($(tags_for_flavor "$FLAVOR"))

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

build_and_push_arch() {
  local ARCH="$1"
  publish_docker_images_with_arch_suffix jammy "${ARCH}"     # Ubuntu 22.04
  publish_docker_images_with_arch_suffix noble "${ARCH}"     # Ubuntu 24.04
  publish_docker_images_with_arch_suffix resolute "${ARCH}"  # Ubuntu 26.04
}

publish_manifests() {
  publish_docker_manifest jammy amd64 arm64     # Ubuntu 22.04
  publish_docker_manifest noble amd64 arm64     # Ubuntu 24.04
  publish_docker_manifest resolute amd64 arm64  # Ubuntu 26.04
}

case "${MODE}" in
  amd64|arm64)
    build_and_push_arch "${MODE}"
    ;;
  manifests)
    publish_manifests
    ;;
  version-tag)
    echo "${VERSION_TAG}"
    ;;
  ""|all)
    # Backwards-compatible end-to-end path for a single host.
    build_and_push_arch amd64
    build_and_push_arch arm64
    publish_manifests
    ;;
  *)
    echo "ERROR: unknown mode - '${MODE}'. Must be 'amd64', 'arm64', 'manifests', 'version-tag', or 'all'"
    exit 1
    ;;
esac
