#!/bin/bash

set -e

if [[ -z "${ANDROID_HOME}" ]]; then
    export SDKDIR=$PWD/.android-sdk
    export ANDROID_HOME=${SDKDIR}
    export ANDROID_SDK_ROOT=${SDKDIR}
fi

ANDROID_ARCH="x86_64"

# on MacOS M1 we need to use arm64 (can't emulate x86_64)
if [[ "$(uname -m)" == "arm64" ]]; then
    ANDROID_ARCH="arm64-v8a"
fi

${ANDROID_HOME}/tools/bin/avdmanager delete avd --name android33 || true
echo "y" | ${ANDROID_HOME}/tools/bin/sdkmanager --install "system-images;android-33;google_apis;$ANDROID_ARCH"
echo "no" | ${ANDROID_HOME}/tools/bin/avdmanager create avd --force --name android33 --device "Nexus 5X" --package "system-images;android-33;google_apis;$ANDROID_ARCH"
${ANDROID_HOME}/emulator/emulator -list-avds
