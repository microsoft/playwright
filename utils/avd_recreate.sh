#!/bin/bash

set -e

if [[ -z "${ANDROID_HOME}" ]]; then
    export SDKDIR=$PWD/.android-sdk
    export ANDROID_HOME=${SDKDIR}
    export ANDROID_SDK_ROOT=${SDKDIR}
fi

${ANDROID_HOME}/tools/bin/avdmanager delete avd --name android30 || true
echo "y" | ${ANDROID_HOME}/tools/bin/sdkmanager --install "system-images;android-30;google_apis;x86"
echo "no" | ${ANDROID_HOME}/tools/bin/avdmanager create avd --force --name android30 --device "Nexus 5X" --package "system-images;android-30;google_apis;x86"
${ANDROID_HOME}/emulator/emulator -list-avds
