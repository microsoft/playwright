#!/usr/bin/env bash

set -e

if [[ -z "${ANDROID_HOME}" ]]; then
    export ANDROID_HOME="$PWD/.android-sdk"
fi

bash $PWD/utils/avd_stop.sh

echo "Starting emulator"
# nohup ${ANDROID_HOME}/emulator/emulator -avd android33 -gpu swiftshader &
nohup ${ANDROID_HOME}/emulator/emulator -avd android33 -no-audio -no-window -no-boot-anim -no-snapshot &
${ANDROID_HOME}/platform-tools/adb wait-for-device shell 'while [[ -z $(getprop sys.boot_completed | tr -d '\r') ]]; do sleep 1; done; input keyevent 82'
${ANDROID_HOME}/platform-tools/adb devices
echo "Emulator started"

echo "Installing Chromium WebView"
# See here for the latest revision: https://storage.googleapis.com/chromium-browser-snapshots/Android/LAST_CHANGE
CHROMIUM_ANDROID_REVISION="1190572"
WEBVIEW_TMP_DIR="$(mktemp -d)"
WEBVIEW_TMP_FILE="$WEBVIEW_TMP_DIR/chrome-android-zip"
curl -s -o "${WEBVIEW_TMP_FILE}" "https://storage.googleapis.com/chromium-browser-snapshots/Android/${CHROMIUM_ANDROID_REVISION}/chrome-android.zip"
unzip -q "${WEBVIEW_TMP_FILE}" -d "${WEBVIEW_TMP_DIR}"
${ANDROID_HOME}/platform-tools/adb install -r "${WEBVIEW_TMP_DIR}/chrome-android/apks/SystemWebViewShell.apk"
rm -rf "${WEBVIEW_TMP_DIR}"
echo "Chromium WebView installed"
