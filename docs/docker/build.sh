#!/bin/bash
set -e
set +x

if [[ ($1 == '--help') || ($1 == '-h') || ($1 == '') || ($2 == '') || ($3 == '') ]]; then
  echo "usage: $(basename $0) {bionic,focal} playwright-base:localbuild-bionic playwright:localbuild-bionic"
  echo
  echo "Build Playwright base nad npm docker images and tag them as "
  echo "'playwright-base:localbuild-bionic' and 'playwright:localbuild-bionic'."
  echo "Once image is built, you can run it with"
  echo ""
  echo "  docker run --rm -it playwright:localbuild-bionic /bin/bash"
  echo ""
  echo "NOTE: this requires on Playwright dependencies to be installed with 'npm install'"
  echo "      and Playwright itself being built with 'npm run build'"
  echo ""
  exit 0
fi

BASE_IMAGE_LABEL=$2
# First build the base image with browser dependencies. It is reused across
# playwright language bindings (Java, Python etc.).
docker build -t "$BASE_IMAGE_LABEL" -f "Dockerfile.$1-base" .

function cleanup() {
  rm -f "playwright.tar.gz"
}

trap "cleanup; cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

# We rely on `./playwright.tar.gz` to download browsers into the docker
# image.
node ../../packages/build_package.js playwright ./playwright.tar.gz

docker build -t "$3" -f "Dockerfile.$1" --build-arg BASE_IMAGE="$BASE_IMAGE_LABEL" .
