#!/bin/bash

set -e

if [[ -z "${ANDROID_HOME}" ]]; then
    SDKDIR=$PWD/.android-sdk
    export ANDROID_HOME=${SDKDIR}
    export ANDROID_SDK_ROOT=${SDKDIR}
fi

bash $PWD/utils/avd_stop.sh

echo "Starting emulator"
# On normal macOS GitHub Action runners, the host GPU is not available. So 'swiftshader_indirect' would have to be used.
# Since we (Playwright) run our tests on a selfhosted mac, the host GPU is available, so we use it.
nohup ${ANDROID_HOME}/emulator/emulator -avd android33 -no-audio -no-window -gpu host -no-boot-anim -no-snapshot &
${ANDROID_HOME}/platform-tools/adb wait-for-device shell 'while [[ -z $(getprop sys.boot_completed | tr -d '\r') ]]; do sleep 1; done; input keyevent 82'
${ANDROID_HOME}/platform-tools/adb devices
echo "Emulator started"

echo "Installing Chromium WebView"
CHROMIUM_ANDROID_REVISION="1030456"
WEBVIEW_TMP_DIR="$(mktemp -d)"
WEBVIEW_TMP_FILE="$WEBVIEW_TMP_DIR/chrome-android-zip"
curl -s -o "${WEBVIEW_TMP_FILE}" "https://storage.googleapis.com/chromium-browser-snapshots/Android/${CHROMIUM_ANDROID_REVISION}/chrome-android.zip"
unzip -q "${WEBVIEW_TMP_FILE}" -d "${WEBVIEW_TMP_DIR}"
${ANDROID_HOME}/platform-tools/adb install -r "${WEBVIEW_TMP_DIR}/chrome-android/apks/SystemWebViewShell.apk"
rm -rf "${WEBVIEW_TMP_DIR}"
echo "Chromium WebView installed"
