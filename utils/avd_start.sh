#!/usr/bin/env bash

set -e

if [[ -z "${ANDROID_HOME}" ]]; then
    export ANDROID_HOME="$PWD/.android-sdk"
fi

bash $PWD/utils/avd_stop.sh

EMULATOR_EXTRA_ARGS=()
if [[ "${PWTEST_ANDROID_NO_ACCEL}" == "1" ]]; then
    # Software-only emulation: disable HW hypervisor and use software GPU.
    EMULATOR_EXTRA_ARGS+=(-accel off -gpu swiftshader_indirect)
fi

EMULATOR_LOG="${PWD}/emulator.log"
echo "Starting emulator (log: ${EMULATOR_LOG})"
nohup ${ANDROID_HOME}/emulator/emulator -avd android35 -no-audio -no-window -no-boot-anim -no-snapshot "${EMULATOR_EXTRA_ARGS[@]}" >"${EMULATOR_LOG}" 2>&1 &
EMULATOR_PID=$!

BOOT_TIMEOUT_SECONDS="${PWTEST_ANDROID_BOOT_TIMEOUT:-600}"
echo "Waiting up to ${BOOT_TIMEOUT_SECONDS}s for boot_completed"
if ! timeout "${BOOT_TIMEOUT_SECONDS}" ${ANDROID_HOME}/platform-tools/adb wait-for-device shell 'while [[ -z $(getprop sys.boot_completed | tr -d '\r') ]]; do sleep 1; done; input keyevent 82'; then
    echo "Emulator failed to boot within ${BOOT_TIMEOUT_SECONDS}s"
    if kill -0 "${EMULATOR_PID}" 2>/dev/null; then
        echo "Emulator process ${EMULATOR_PID} still running"
    else
        echo "Emulator process ${EMULATOR_PID} exited"
    fi
    echo "----- emulator.log -----"
    cat "${EMULATOR_LOG}" || true
    echo "----- end emulator.log -----"
    exit 1
fi
${ANDROID_HOME}/platform-tools/adb devices
echo "Emulator started"

echo "Installing Chromium WebView"
# See here for the latest revision: https://storage.googleapis.com/chromium-browser-snapshots/Android/LAST_CHANGE
CHROMIUM_ANDROID_REVISION="1340145"
WEBVIEW_TMP_DIR="$(mktemp -d)"
WEBVIEW_TMP_FILE="$WEBVIEW_TMP_DIR/chrome-android-zip"
curl -s -o "${WEBVIEW_TMP_FILE}" "https://storage.googleapis.com/chromium-browser-snapshots/Android/${CHROMIUM_ANDROID_REVISION}/chrome-android.zip"
unzip -q "${WEBVIEW_TMP_FILE}" -d "${WEBVIEW_TMP_DIR}"
${ANDROID_HOME}/platform-tools/adb install -r "${WEBVIEW_TMP_DIR}/chrome-android/apks/SystemWebViewShell.apk"
rm -rf "${WEBVIEW_TMP_DIR}"
echo "Chromium WebView installed"
