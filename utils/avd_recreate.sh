#!/bin/bash

set -e

if [[ -z "${ANDROID_HOME}" ]]; then
    export SDKDIR=$PWD/.android-sdk
    export ANDROID_HOME=${SDKDIR}
    export ANDROID_SDK_ROOT=${SDKDIR}
fi

${ANDROID_HOME}/tools/bin/avdmanager delete avd --name android32 || true
echo "y" | ${ANDROID_HOME}/tools/bin/sdkmanager --install "system-images;android-32;google_apis;x86_64"
echo "no" | ${ANDROID_HOME}/tools/bin/avdmanager create avd --force --name android32 --device "Nexus 5X" --package "system-images;android-32;google_apis;x86_64"
${ANDROID_HOME}/emulator/emulator -list-avds
