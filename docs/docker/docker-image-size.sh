#!/bin/bash
set -e
set +x

# This script computes **compressed image size with all its layers**.
# This solution is based on https://stackoverflow.com/a/55156181/314883

DOCKER_IMAGE_NAME="docker-image-to-count-compressed-size"
FILE_NAME="docker-image-to-count-compressed-size"

function cleanup() {
  echo "-- Removing .tar if any"
  rm -f "${FILE_NAME}.tar"
  echo "-- Removing .tar.gz if any"
  rm -f "${FILE_NAME}.tar.gz"
  echo "-- Removing docker image if any"
  docker rmi "${DOCKER_IMAGE_NAME}:bionic" >/dev/null
}

trap "cleanup; cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

echo "-- Building image..."
docker build -t "${DOCKER_IMAGE_NAME}:bionic" -f Dockerfile.bionic . >/dev/null
echo "-- Saving .tar of the image..."
docker save "${DOCKER_IMAGE_NAME}:bionic" > "${FILE_NAME}.tar"
echo "-- Compressing image..."
gzip "${FILE_NAME}.tar" >/dev/null

echo "(generated with docker-image-size.sh)" > CURRENT_DOCKER_IMAGE_SIZE
du -sh ${FILE_NAME}.tar.gz | cut -f1 | xargs >> CURRENT_DOCKER_IMAGE_SIZE

