#!/bin/bash

set -e

if [[ -z "${ANDROID_HOME}" ]]; then
    SDKDIR=$PWD/.android-sdk
    export ANDROID_HOME=${SDKDIR}
    export ANDROID_SDK_ROOT=${SDKDIR}
fi

echo "Killing previous emulators"
${ANDROID_HOME}/platform-tools/adb devices | grep emulator | cut -f1 | while read line; do ${ANDROID_HOME}/platform-tools/adb -s $line emu kill; done

EMULATOR_GPU="host"
if [[ -n "${GITHUB_ACTIONS}" ]]; then
    EMULATOR_GPU="swiftshader_indirect"
fi

echo "Starting emulator"
nohup ${ANDROID_HOME}/emulator/emulator -avd android32 -no-audio -no-window -gpu ${EMULATOR_GPU} -no-boot-anim &
${ANDROID_HOME}/platform-tools/adb wait-for-device shell 'while [[ -z $(getprop sys.boot_completed | tr -d '\r') ]]; do sleep 1; done; input keyevent 82'
${ANDROID_HOME}/platform-tools/adb devices
echo "Emulator started"