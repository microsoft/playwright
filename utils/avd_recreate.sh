#!/usr/bin/env bash

set -e

if [[ -z "${ANDROID_HOME}" ]]; then
    export ANDROID_HOME="$PWD/.android-sdk"
fi

ANDROID_ARCH="x86_64"

# on MacOS M1 we need to use arm64 (can't emulate x86_64)
if [[ "$(uname -m)" == "arm64" ]]; then
    ANDROID_ARCH="arm64-v8a"
fi

echo "--- env (android/xdg/home) ---"
env | grep -iE 'android|xdg|^home=' | sort || true
echo "--- avdmanager version ---"
"${ANDROID_HOME}/cmdline-tools/latest/bin/avdmanager" --version || true

${ANDROID_HOME}/cmdline-tools/latest/bin/avdmanager delete avd --name android35 || true
yes | ${ANDROID_HOME}/cmdline-tools/latest/bin/sdkmanager --install "system-images;android-35;google_apis;$ANDROID_ARCH" platform-tools emulator
echo "no" | ${ANDROID_HOME}/cmdline-tools/latest/bin/avdmanager create avd --force --name android35 --device "Nexus 5X" --package "system-images;android-35;google_apis;$ANDROID_ARCH"

echo "--- avdmanager list avd ---"
"${ANDROID_HOME}/cmdline-tools/latest/bin/avdmanager" list avd || true
echo "--- find android35.ini ---"
find "$HOME" ${XDG_CONFIG_HOME:+"$XDG_CONFIG_HOME"} ${ANDROID_USER_HOME:+"$ANDROID_USER_HOME"} ${ANDROID_AVD_HOME:+"$ANDROID_AVD_HOME"} -maxdepth 6 -name 'android35.ini' 2>/dev/null || true
echo "--- ls candidate AVD dirs ---"
ls -la "$HOME/.android" "$HOME/.android/avd" 2>/dev/null || true
[[ -n "${XDG_CONFIG_HOME:-}" ]] && ls -la "$XDG_CONFIG_HOME/.android" "$XDG_CONFIG_HOME/.android/avd" 2>/dev/null || true
[[ -n "${ANDROID_USER_HOME:-}" ]] && ls -la "$ANDROID_USER_HOME" "$ANDROID_USER_HOME/avd" 2>/dev/null || true
echo "--- emulator -list-avds ---"
${ANDROID_HOME}/emulator/emulator -list-avds
