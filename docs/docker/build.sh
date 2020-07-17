#!/bin/bash
set -e
set +x

if [[ ($1 == '--help') || ($1 == '-h') ]]; then
  echo "usage: $(basename $0) [--prepare-only]"
  echo
  echo "Build Playwright docker image and tag it as 'playwright:localbuild'."
  echo "Once image is built, you can run it with"
  echo ""
  echo "  docker run --rm -it playwright:localbuild /bin/bash"
  echo ""
  echo "NOTE: this requires on Playwright dependencies to be installed with 'npm install'"
  echo "      and Playwright itself being built with 'npm run build'"
  echo
  echo "  --prepare-context    prepare docker context and skip building."
  echo "                       This is to defer building & publishing to Docker Github Action."
  echo ""
  exit 0
fi

PREPARE_CONTEXT_ONLY=""
if [[ $1 == "--prepare-context" ]]; then
  PREPARE_CONTEXT_ONLY="1"
fi

function cleanup() {
  if [[ -z "${PREPARE_CONTEXT_ONLY}" ]]; then
    rm -f "playwright.tar.gz"
  fi
}

trap "cleanup; cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

# We rely on `./playwright.tar.gz` to download browsers into the docker
# image.
node ../../packages/build_package.js playwright ./playwright.tar.gz

if [[ -n "${PREPARE_CONTEXT_ONLY}" ]]; then
  exit 0
fi

docker build -t "playwright:localbuild" -f Dockerfile.bionic .
