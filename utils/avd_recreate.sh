#!/usr/bin/env bash

set -e

if [[ -z "${ANDROID_HOME}" ]]; then
    export ANDROID_HOME="$PWD/.android-sdk"
fi

# Pin AVD storage to ~/.android so cmdline-tools (avdmanager) and the
# emulator binary agree on the location. On Linux runners that set
# XDG_CONFIG_HOME (e.g. GitHub Actions), avdmanager otherwise writes to
# $XDG_CONFIG_HOME/.android/avd while `emulator` only searches $HOME/.android/avd.
export ANDROID_USER_HOME="$HOME/.android"
export ANDROID_AVD_HOME="$HOME/.android/avd"

ANDROID_ARCH="x86_64"

# on MacOS M1 we need to use arm64 (can't emulate x86_64)
if [[ "$(uname -m)" == "arm64" ]]; then
    ANDROID_ARCH="arm64-v8a"
fi

${ANDROID_HOME}/cmdline-tools/latest/bin/avdmanager delete avd --name android35 || true
yes | ${ANDROID_HOME}/cmdline-tools/latest/bin/sdkmanager --install "system-images;android-35;google_apis;$ANDROID_ARCH" platform-tools emulator
echo "no" | ${ANDROID_HOME}/cmdline-tools/latest/bin/avdmanager create avd --force --name android35 --device "Nexus 5X" --package "system-images;android-35;google_apis;$ANDROID_ARCH"
${ANDROID_HOME}/emulator/emulator -list-avds
