#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname "$0")"
SCRIPT_FOLDER=$(pwd -P)
source "${SCRIPT_FOLDER}/../utils.sh"

ELECTRON_BUILD_TOOLS_REQUIRED_VERSION=2c24fb5c7c938a4e387f355ab64be449604ae5db
if [[ -d ./electron-build-tools ]]; then
  cd ./electron-build-tools
  # Make sure required commit is part of electron-build-tools.
  if ! git merge-base --is-ancestor "${ELECTRON_BUILD_TOOLS_REQUIRED_VERSION}" HEAD; then
    cd ..
    rm -rf ./electron-build-tools
    echo "Updating electron-build-tools"
  else
    cd ..
  fi
fi

if [[ ! -d ./electron-build-tools ]]; then
  git clone --single-branch --branch main https://github.com/electron/build-tools/ electron-build-tools
  cd electron-build-tools
  npm install
  mkdir -p third_party
  ./src/e update-goma msftGoma
  cd ..
fi

if ! is_win; then
  if command -v python >/dev/null; then
    PYTHON=python
  elif command -v python3 >/dev/null; then
    PYTHON=python3
  else
    echo "ERROR: no python or python3 found in PATH"
    exit 1
  fi
fi

cd electron-build-tools/third_party/goma

export GOMA_START_COMPILER_PROXY=true

function print_gn_args() {
  PLAYWRIGHT_GOMA_PATH="${SCRIPT_FOLDER}/electron-build-tools/third_party/goma"
  if is_win; then
    PLAYWRIGHT_GOMA_PATH=$(cygpath -w "${PLAYWRIGHT_GOMA_PATH}")
  fi
  echo 'use_goma = true'
  echo "goma_dir = \"${PLAYWRIGHT_GOMA_PATH}\""
}

if [[ $1 == "--help" ]]; then
  echo "$(basename "$0") [login|start|stop|--help]"
  exit 0
elif [[ $1 == "args" ]]; then
  print_gn_args
elif [[ $1 == "login" ]]; then
  if is_win; then
    /c/Windows/System32/cmd.exe "/c $(cygpath -w $(pwd)/goma_auth.bat) login"
  else
    $PYTHON ./goma_auth.py login
  fi
  echo
  echo "Congratulation! Goma is logged in!"
  echo "run '$(basename "$0") start' to launch goma client"
elif [[ $1 == "start" ]]; then
  # We have to prefix ENV with `PLAYWRIGHT` since `GOMA_` env variables
  # have special treatment by goma.
  if [[ ! -z "$PLAYWRIGHT_GOMA_LOGIN_COOKIE" ]]; then
    echo "$PLAYWRIGHT_GOMA_LOGIN_COOKIE" > "$HOME/.goma_oauth2_config"
  fi
  if [[ ! -f "$HOME/.goma_oauth2_config" ]]; then
    echo "ERROR: goma is not logged in!"
    echo "run '$(basename "$0") login'"
    exit 1
  fi
  if is_win; then
    /c/Windows/System32/cmd.exe "/c $(cygpath -w $(pwd)/goma_ctl.bat) ensure_start"
  else
    $PYTHON ./goma_ctl.py ensure_start
  fi
  set +x
  echo
  echo "Congratulatons! Goma is running!"
  echo
  echo "Add the following gn args to use goma:"
  echo
  echo "===== args.gn ====="
  print_gn_args
  echo "===== ======= ====="
elif [[ $1 == "stop" ]]; then
  if is_win; then
    /c/Windows/System32/cmd.exe "/c $(cygpath -w $(pwd)/goma_ctl.bat) stop"
  else
    $PYTHON ./goma_ctl.py stop
  fi
else
  echo "ERROR: unknown command - $1"
  echo "Use --help to list all available commands"
  exit 1
fi
