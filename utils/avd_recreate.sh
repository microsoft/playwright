#!/bin/bash

SDKDIR=$PWD/.android-sdk
export ANDROID_SDK_ROOT=${SDKDIR}
export ANDROID_HOME=${SDKDIR}
export ANDROID_AVD_HOME=${SDKDIR}/avd

${SDKDIR}/cmdline-tools/latest/bin/avdmanager delete avd --name android30
echo -ne '\n' | ${SDKDIR}/cmdline-tools/latest/bin/avdmanager create avd --name android30 --device pixel_4_xl --package "system-images;android-30;google_apis;x86"
