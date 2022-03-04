#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"

USAGE=$(cat<<EOF
  usage: $(basename "$0") [--compile-mac-arm64|--compile-linux|--compile-linux-arm64|--compile-win64|--compile-mac] [--symbols] [--full]

  Compiles chromium.
EOF
)

SCRIPT_FOLDER=$(pwd -P)
source "${SCRIPT_FOLDER}/../utils.sh"

main() {
  if [[ $1 == "--help" || $1 == "-h" ]]; then
    echo "$USAGE"
    exit 0
  elif [[ $1 == "--compile"* ]]; then
    compile_chromium "$1" "$2" "$3"
  else
    echo "ERROR: unknown first argument. Use --help for details."
    exit 1
  fi
}


compile_chromium() {
  if [[ -z "${CR_CHECKOUT_PATH}" ]]; then
    CR_CHECKOUT_PATH="$HOME/chromium"
  fi

  if [[ ! -d "${CR_CHECKOUT_PATH}/src" ]]; then
    echo "ERROR: CR_CHECKOUT_PATH does not have src/ subfolder; is this a chromium checkout?"
    exit 1
  fi

  source "${SCRIPT_FOLDER}/ensure_depot_tools.sh"

  if [[ $1 == "--compile-mac"* ]]; then
    # As of Feb, 2022 Chromium mac compilation requires Xcode13.2
    selectXcodeVersionOrDie "13.2"
    # As of Jan, 2021 Chromium mac compilation is only possible on Intel macbooks.
    # See https://chromium.googlesource.com/chromium/src.git/+/main/docs/mac_arm64.md
    if [[ $1 == "--compile-mac-arm64" && $(uname -m) != "x86_64" ]]; then
      echo "ERROR: chromium mac arm64 compilation is (ironically) only supported on Intel Macbooks"
      exit 1
    fi
  fi

  cd "${CR_CHECKOUT_PATH}/src"

  # Prepare build folder.
  mkdir -p "./out/Default"
  echo "is_debug = false" > ./out/Default/args.gn
  echo "dcheck_always_on = false" >> ./out/Default/args.gn
  if [[ $2 == "--symbols" || $3 == "--symbols" ]]; then
    echo "symbol_level = 1" >> ./out/Default/args.gn
  else
    echo "symbol_level = 0" >> ./out/Default/args.gn
  fi

  if [[ $1 == "--compile-mac-arm64" ]]; then
    echo 'target_cpu = "arm64"' >> ./out/Default/args.gn
  elif [[ $1 == "--compile-linux-arm64" ]]; then
    echo 'target_cpu = "arm64"' >> ./out/Default/args.gn
  fi

  if [[ ! -z "$USE_GOMA" ]]; then
    PLAYWRIGHT_GOMA_PATH="${SCRIPT_FOLDER}/electron-build-tools/third_party/goma"
    if [[ $1 == "--compile-win"* ]]; then
      PLAYWRIGHT_GOMA_PATH=$(cygpath -w "${PLAYWRIGHT_GOMA_PATH}")
    fi
    echo 'use_goma = true' >> ./out/Default/args.gn
    echo "goma_dir = \"${PLAYWRIGHT_GOMA_PATH}\"" >> ./out/Default/args.gn
  fi
  echo 'enable_nacl = false' >> ./out/Default/args.gn

  echo "===== args.gn ====="
  cat ./out/Default/args.gn
  echo "===== ======= ====="

  if [[ $2 == "--full" || $3 == "--full" ]]; then
    if [[ $(uname) == "--compile-linux" ]]; then
      ./build/install-build-deps.sh
    elif [[ $1 == "--compile-linux-arm64" ]]; then
      ./build/install-build-deps.sh
      # Install sysroot image, see https://chromium.googlesource.com/chromium/src/+/refs/heads/main/docs/linux/chromium_arm.md
      ./build/linux/sysroot_scripts/install-sysroot.py --arch=arm64
    fi
  fi

  if [[ $1 == "--compile-win"* ]]; then
    if [[ -z "$USE_GOMA" ]]; then
      /c/Windows/System32/cmd.exe "/c $(cygpath -w "${SCRIPT_FOLDER}"/buildwin.bat)"
    else
      /c/Windows/System32/cmd.exe "/c $(cygpath -w "${SCRIPT_FOLDER}"/buildwingoma.bat)"
    fi
  else
    gn gen out/Default
    if [[ $1 == "--compile-linux"* ]]; then
      TARGETS="chrome chrome_sandbox clear_key_cdm"
    else
      TARGETS="chrome"
    fi
    if [[ -z "$USE_GOMA" ]]; then
      autoninja -C out/Default $TARGETS
    else
      ninja -j 200 -C out/Default $TARGETS
    fi
  fi
}

main "$1" "$2" "$3"
