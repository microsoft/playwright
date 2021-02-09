#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd "$(dirname $0)"

if [[ ! -d ./electron-build-tools ]]; then
  git clone --single-branch --branch msft-goma  https://github.com/electron/build-tools/ electron-build-tools
  cd electron-build-tools
  npm install
  mkdir -p third_party
  ./src/e update-goma msftGoma
  cd ..
fi

cd electron-build-tools

if [[ $1 == "--help" ]]; then
  echo "$(basename $0) [login|start|stop|--help]"
  exit 0
elif [[ $1 == "login" ]]; then
  python ./third_party/goma/goma_auth.py login
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
  python ./third_party/goma/goma_ctl.py ensure_start
elif [[ $1 == "stop" ]]; then
  python ./third_party/goma/goma_ctl.py stop
else
  echo "ERROR: unknown command - $1"
  echo "Use --help to list all available commands"
  exit 1
fi

