#!/usr/bin/env bash

set -e

if [[ -z "${ANDROID_HOME}" ]]; then
    export ANDROID_HOME="$PWD/.android-sdk"
fi

echo "Killing previous emulators"
${ANDROID_HOME}/platform-tools/adb devices | grep emulator | cut -f1 | while read line; do ${ANDROID_HOME}/platform-tools/adb -s $line emu kill; done
