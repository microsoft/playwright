#!/usr/bin/env bash

set -e

if [[ -z "${ANDROID_HOME}" ]]; then
    export ANDROID_HOME="$PWD/.android-sdk"
fi

bash $PWD/utils/avd_stop.sh

echo "Starting emulator"
# nohup ${ANDROID_HOME}/emulator/emulator -avd android35 -gpu swiftshader &
nohup ${ANDROID_HOME}/emulator/emulator -avd android35 -no-audio -no-window -no-boot-anim -no-snapshot -writable-system &
${ANDROID_HOME}/platform-tools/adb wait-for-device shell 'while [[ -z $(getprop sys.boot_completed | tr -d '\r') ]]; do sleep 1; done; input keyevent 82'
${ANDROID_HOME}/platform-tools/adb devices
echo "Emulator started"

echo "Installing Chromium WebView"
# See here for the latest revision: https://storage.googleapis.com/chromium-browser-snapshots/Android/LAST_CHANGE
CHROMIUM_ANDROID_REVISION="1441404"
WEBVIEW_TMP_DIR="$(mktemp -d)"

curl -s --fail --retry 5 -o "$WEBVIEW_TMP_DIR/chrome-android.zip" "https://storage.googleapis.com/chromium-browser-snapshots/Android/${CHROMIUM_ANDROID_REVISION}/chrome-android.zip"
unzip -q "$WEBVIEW_TMP_DIR/chrome-android.zip" -d "${WEBVIEW_TMP_DIR}"

if [[ "$(uname -m)" == "arm64" ]]; then
    curl -s --fail --retry 5 -o "$WEBVIEW_TMP_DIR/chrome-android-arm64.zip" "https://storage.googleapis.com/chromium-browser-snapshots/Android_Arm64/${CHROMIUM_ANDROID_REVISION}/chrome-android.zip"
    unzip -o -q "$WEBVIEW_TMP_DIR/chrome-android-arm64.zip" -d "${WEBVIEW_TMP_DIR}"
fi
# SystemWebViewShell.apk is ABI-neutral, so we can use it for both arm and arm64. Its not contained in the arm64 zip.
${ANDROID_HOME}/platform-tools/adb install -r "${WEBVIEW_TMP_DIR}/chrome-android/apks/SystemWebViewShell.apk"
${ANDROID_HOME}/platform-tools/adb install -r "${WEBVIEW_TMP_DIR}/chrome-android/apks/SystemWebView.apk"

rm -rf "${WEBVIEW_TMP_DIR}"
echo "Chromium WebView installed"
