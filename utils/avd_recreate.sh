#!/bin/bash

set -e

if [[ -z "${ANDROID_HOME}" ]]; then
    export SDKDIR=$PWD/.android-sdk
    export ANDROID_HOME=${SDKDIR}
    export ANDROID_SDK_ROOT=${SDKDIR}
fi

device_name="android32"
package="system-images;android-32;google_apis;x86_64"

${ANDROID_HOME}/tools/bin/avdmanager delete avd --name "${device_name}" || true
echo "y" | ${ANDROID_HOME}/tools/bin/sdkmanager --install "${package}"
echo "no" | ${ANDROID_HOME}/tools/bin/avdmanager create avd --force --name android32 --device "Nexus 5X" --package "${package}"
${ANDROID_HOME}/emulator/emulator -list-avds
