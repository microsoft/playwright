#!/bin/bash
set -e
set -x

trap "cd $(pwd -P)" EXIT
cd "$(dirname $0)"

if [[ ! -d ./electron-build-tools ]]; then
  git clone --single-branch --branch master https://github.com/electron/build-tools/ electron-build-tools
  cd electron-build-tools
  npm install
  mkdir -p third_party
  ./src/e update-goma msftGoma
  cd ..
fi

cd electron-build-tools/third_party/goma

export GOMA_START_COMPILER_PROXY=true

if [[ $1 == "--help" ]]; then
  echo "$(basename $0) [login|start|stop|--help]"
  exit 0
elif [[ $1 == "login" ]]; then
  if [[ $(uname) == "MINGW"* ]]; then
    /c/Windows/System32/cmd.exe "/c $(cygpath -w $(pwd)/goma_auth.bat) login"
  else
    python ./goma_auth.py login
  fi
elif [[ $1 == "start" ]]; then
  # We have to prefix ENV with `PLAYWRIGHT` since `GOMA_` env variables
  # have special treatment by goma.
  if [[ ! -z "$PLAYWRIGHT_GOMA_LOGIN_COOKIE" ]]; then
    echo "$PLAYWRIGHT_GOMA_LOGIN_COOKIE" > "$HOME/.goma_oauth2_config"
  fi
  if [[ ! -f "$HOME/.goma_oauth2_config" ]]; then
    echo "ERROR: goma is not logged in!"
    echo "run '$(basename $0) login'"
    exit 1
  fi
  if [[ $(uname) == "MINGW"* ]]; then
    /c/Windows/System32/cmd.exe "/c $(cygpath -w $(pwd)/goma_ctl.bat) ensure_start"
  else
    python ./goma_ctl.py ensure_start
  fi
elif [[ $1 == "stop" ]]; then
  if [[ $(uname) == "MINGW"* ]]; then
    /c/Windows/System32/cmd.exe "/c $(cygpath -w $(pwd)/goma_ctl.bat) stop"
  else
    python ./goma_ctl.py stop
  fi
else
  echo "ERROR: unknown command - $1"
  echo "Use --help to list all available commands"
  exit 1
fi

