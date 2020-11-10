#!/bin/bash

SDKDIR=$PWD/.android-sdk
export ANDROID_SDK_ROOT=${SDKDIR}
export ANDROID_HOME=${SDKDIR}
export ANDROID_AVD_HOME=${SDKDIR}/avd

${SDKDIR}/emulator/emulator -avd android30
