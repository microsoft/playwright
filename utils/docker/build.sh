#!/usr/bin/env bash
set -e
set +x

if [[ ($1 == '--help') || ($1 == '-h') || ($1 == '') || ($2 == '') ]]; then
  echo "usage: $(basename $0) {--arm64,--amd64} {jammy,noble,resolute} playwright:localbuild-noble"
  echo
  echo "Build Playwright docker image and tag it as 'playwright:localbuild-noble'."
  echo "Once image is built, you can run it with"
  echo ""
  echo "  docker run --rm -it playwright:localbuild-noble /bin/bash"
  echo ""
  echo "NOTE: this requires on Playwright dependencies to be installed with 'npm install'"
  echo "      and Playwright itself being built with 'npm run build'"
  echo ""
  exit 0
fi

function cleanup() {
  rm -f "playwright-core.tar.gz"
}

trap "cleanup; cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

# We rely on `./playwright-core.tar.gz` to download browsers into the docker
# image.
node ../../utils/pack_package.js playwright-core ./playwright-core.tar.gz

PLATFORM=""
if [[ "$1" == "--arm64" ]]; then
  PLATFORM="linux/arm64";
elif [[ "$1" == "--amd64" ]]; then
  PLATFORM="linux/amd64"
else
  echo "ERROR: unknown platform specifier - $1. Only --arm64 or --amd64 is supported"
  exit 1
fi

SECRET_ARGS=()
if [[ -n "${NPMRC_SECRET:-}" ]]; then
  SECRET_ARGS+=(--secret "id=npmrc,src=${NPMRC_SECRET}")
fi

# Keep each arch image a plain single-platform manifest without the unknown/unknown platform entry.
export BUILDX_NO_DEFAULT_ATTESTATIONS=1

# Docker builds fail intermittently: arm64 images are cross-built under QEMU
# user-mode emulation, where ldconfig segfaults at startup (tonistiigi/binfmt#298,
# every binfmt build since QEMU 8.1.4), and both archs can hit transient network
# errors while downloading packages. Retry: BuildKit keeps the layers that already
# succeeded, so a retry re-runs only the failed RUN step.
MAX_ATTEMPTS=3

for ((attempt = 1; attempt <= MAX_ATTEMPTS; attempt++)); do
  if docker build --platform "${PLATFORM}" \
      --build-arg ACR_CACHE_PREFIX="${ACR_CACHE_PREFIX}" \
      --build-arg UBUNTU_MIRROR_PREFIX="${UBUNTU_MIRROR_PREFIX}" \
      "${SECRET_ARGS[@]}" \
      -t "$3" -f "Dockerfile.$2" .; then
    exit 0
  fi
  if (( attempt < MAX_ATTEMPTS )); then
    echo "docker build failed (attempt ${attempt}/${MAX_ATTEMPTS}), retrying..." >&2
  fi
done
echo "ERROR: docker build failed after ${MAX_ATTEMPTS} attempt(s)" >&2
exit 1
