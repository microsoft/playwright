#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"
SCRIPT_FOLDER=$(pwd -P)

USAGE=$(cat<<EOF
  usage: $(basename "$0") [--arm64] [--symbols] [--full] [--goma] <custom targets to compile>

  --arm64     cross-compile for arm64
  --symbols   compile with symbols
  --full      install build dependencies
  --goma      use goma when compiling. Make sure to pre-start goma client beforehand with './goma.sh start'.

  On Linux & MacOS, it is possible to specify custom compilation targets:

    ./build.sh --goma blink_tests

EOF
)

source "${SCRIPT_FOLDER}/../utils.sh"

if [[ $1 == "--help" || $1 == "-h" ]]; then
  echo "$USAGE"
  exit 0
fi

args=("$@")
IS_ARM64=""
IS_SYMBOLS_BUILD=""
IS_FULL=""
USE_GOMA=""
for ((i=0; i<="${#args[@]}"; ++i)); do
    case ${args[i]} in
        --arm64) IS_ARM64="1"; unset args[i]; ;;
        --symbols) IS_SYMBOLS_BUILD="1"; unset args[i]; ;;
        --full) IS_FULL="1"; unset args[i]; ;;
        --goma) USE_GOMA="1"; unset args[i]; ;;
    esac
done

compile_chromium() {
  if [[ -z "${CR_CHECKOUT_PATH}" ]]; then
    CR_CHECKOUT_PATH="$HOME/chromium"
  fi

  if [[ ! -d "${CR_CHECKOUT_PATH}/src" ]]; then
    echo "ERROR: CR_CHECKOUT_PATH does not have src/ subfolder; is this a chromium checkout?"
    exit 1
  fi

  source "${SCRIPT_FOLDER}/ensure_depot_tools.sh"

  if [[ $(uname) == "Darwin" ]]; then
    # As of Feb, 2022 Chromium mac compilation requires Xcode13.2
    selectXcodeVersionOrDie "13.2"
  fi

  cd "${CR_CHECKOUT_PATH}/src"

  # Prepare build folder.
  mkdir -p "./out/Default"
  echo "is_debug = false" > ./out/Default/args.gn
  echo "dcheck_always_on = false" >> ./out/Default/args.gn
  if [[ -n "${IS_SYMBOLS_BUILD}" ]]; then
    echo "symbol_level = 1" >> ./out/Default/args.gn
  else
    echo "symbol_level = 0" >> ./out/Default/args.gn
  fi

  if [[ -n "${IS_ARM64}" ]]; then
    echo 'target_cpu = "arm64"' >> ./out/Default/args.gn
  fi

  if [[ ! -z "$USE_GOMA" ]]; then
    "${SCRIPT_FOLDER}/goma.sh" args >> ./out/Default/args.gn
  fi
  echo 'enable_nacl = false' >> ./out/Default/args.gn

  echo "===== args.gn ====="
  cat ./out/Default/args.gn
  echo "===== ======= ====="

  if [[ -n "$IS_FULL" ]]; then
    if [[ $(uname) == "Linux" ]]; then
      ./build/install-build-deps.sh
      if [[ -n "$IS_ARM64" ]]; then
        # Install sysroot image, see https://chromium.googlesource.com/chromium/src/+/refs/heads/main/docs/linux/chromium_arm.md
        ./build/linux/sysroot_scripts/install-sysroot.py --arch=arm64
      fi
    fi
  fi

  TARGETS="$@"
  if [[ $(uname) == "MINGW" ]]; then
    if [[ -n "$TARGETS" ]]; then
      echo "ERROR: cannot compile custom targets on windows yet."
      echo "Requested to compile chromium targets - ${TARGETS}"
      exit 1
    fi
    if [[ -z "$USE_GOMA" ]]; then
      /c/Windows/System32/cmd.exe "/c $(cygpath -w "${SCRIPT_FOLDER}"/buildwin.bat)"
    else
      /c/Windows/System32/cmd.exe "/c $(cygpath -w "${SCRIPT_FOLDER}"/buildwingoma.bat)"
    fi
  else
    gn gen out/Default
    if [[ -z "$TARGETS" ]]; then
      if [[ $(uname) == "Linux" ]]; then
        TARGETS="chrome chrome_sandbox clear_key_cdm"
      else
        TARGETS="chrome"
      fi
    fi
    if [[ -z "$USE_GOMA" ]]; then
      autoninja -C out/Default $TARGETS
    else
      ninja -j 200 -C out/Default $TARGETS
    fi
  fi
}

compile_chromium "${args[@]}"
