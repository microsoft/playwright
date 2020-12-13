#!/bin/bash

set -e

if [[ -z "${ANDROID_HOME}" ]]; then
    SDKDIR=$PWD/.android-sdk
    export ANDROID_HOME=${SDKDIR}
    export ANDROID_SDK_ROOT=${SDKDIR}
fi

echo "Killing previous emulators"
adb devices | grep emulator | cut -f1 | while read line; do adb -s $line emu kill; done

echo "Starting emulator"
nohup ${ANDROID_HOME}/emulator/emulator -avd android30 -no-audio -no-snapshot -no-window -gpu swiftshader_indirect &
${ANDROID_HOME}/platform-tools/adb wait-for-device shell 'while [[ -z $(getprop sys.boot_completed | tr -d '\r') ]]; do sleep 1; done; input keyevent 82'
${ANDROID_HOME}/platform-tools/adb devices
echo "Emulator started"