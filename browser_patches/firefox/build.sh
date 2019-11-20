#!/bin/bash
set -e
set +x

trap "cd $(pwd -P)" EXIT
cd checkout

if ! [[ $(git rev-parse --abbrev-ref HEAD) == "pwdev" ]]; then
  echo "ERROR: Cannot build any branch other than PWDEV"
  exit 1;
else
  echo "-- checking git branch is PWDEV - OK"
fi

if [[ "$(uname)" == "Darwin" ]]; then
  # Firefox currently does not build on 10.15 out of the box - it requires SDK for 10.14.
  # Make sure the SDK is out there.
  if [[ $(sw_vers -productVersion) == "10.15" ]]; then
    if ! [[ -d $HOME/SDK-archive/MacOSX10.14.sdk ]]; then
      echo "As of Nov 2019, Firefox does not build on Mac 10.15 without 10.14 SDK."
      echo "Check out instructions on getting 10.14 sdk at https://developer.mozilla.org/en-US/docs/Mozilla/Developer_guide/Build_Instructions/Mac_OS_X_Prerequisites"
      echo "and make sure to put SDK to $HOME/SDK-archive/MacOSX10.14.sdk/"
      exit 1
    else
      echo "-- configuting .mozconfig with 10.14 SDK path"
      echo "ac_add_options --with-macos-sdk=$HOME/SDK-archive/MacOSX10.14.sdk/" > .mozconfig
    fi
  fi
  echo "-- building on Mac"
elif [[ "$(uname)" == "Linux" ]]; then
  echo "-- building on Linux"
else
  echo "ERROR: cannot upload on this platform!" 1>&2
  exit 1;
fi

./mach build
./mach package
