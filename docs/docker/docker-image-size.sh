#!/bin/bash
set -e
set +x

# This script computes **compressed image size with all its layers**.
# This solution is based on https://stackoverflow.com/a/55156181/314883


if [[ ($1 == '--help') || ($1 == '-h') ]]; then
  echo "usage: $(basename $0) [--image-name <local image to compute size>]"
  echo
  echo "Compute docker image size defined by the 'Dockerfile.bionic'."
  echo ""
  echo "Script will build the image using 'build.sh', unless '--image-name'"
  echo "is specified."
  echo ""
  echo "NOTE: this requires on Playwright dependencies to be installed with 'npm install'"
  echo "      and Playwright itself being built with 'npm run build'"
  echo
  echo "  --image-name    custom image name to compute size of."
  echo ""
  exit 0
fi

CUSTOM_IMAGE_NAME=""
if [[ $1 == "--image-name" ]]; then
  CUSTOM_IMAGE_NAME=$2
fi

TMP_IMAGE_NAME="docker-image-to-count-compressed-size"
FILE_NAME="docker-image-to-count-compressed-size"

function cleanup() {
  rm -f "${FILE_NAME}.tar"
  rm -f "${FILE_NAME}.tar.gz"
  docker rmi "${TMP_IMAGE_NAME}:bionic" >/dev/null
}

trap "cleanup; cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

if [[ -z "${CUSTOM_IMAGE_NAME}" ]]; then
  echo "-- Building image..."
  ./build.sh >/dev/null
  echo "-- Saving .tar of the image..."
  docker save "${TMP_IMAGE_NAME}:bionic" > "${FILE_NAME}.tar"
else
  echo "-- Saving .tar of the image..."
  docker save "${CUSTOM_IMAGE_NAME}" > "${FILE_NAME}.tar"
fi
echo "-- Compressing image..."
gzip "${FILE_NAME}.tar" >/dev/null

echo "(generated with docker-image-size.sh)" > CURRENT_DOCKER_IMAGE_SIZE
du -sh ${FILE_NAME}.tar.gz | cut -f1 | xargs >> CURRENT_DOCKER_IMAGE_SIZE

