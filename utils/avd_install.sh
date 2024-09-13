#!/usr/bin/env bash

set -e

if [[ -n "${ANDROID_HOME}" ]]; then
    echo "ANDROID_HOME is already set. This script is only for a local installation of the Android SDK."
    exit 1
fi

export ANDROID_HOME="$PWD/.android-sdk"

mkdir -p ${ANDROID_HOME}/cmdline-tools

echo Downloading Android SDK...
cd ${ANDROID_HOME}/cmdline-tools
COMMAND_LINE_TOOLS_ZIP=${ANDROID_HOME}/commandlinetools.zip
# https://developer.android.com/studio
curl https://dl.google.com/android/repository/commandlinetools-mac-11076708_latest.zip -o ${COMMAND_LINE_TOOLS_ZIP}
unzip ${COMMAND_LINE_TOOLS_ZIP} 
rm ${COMMAND_LINE_TOOLS_ZIP}
mv cmdline-tools latest

echo Installing emulator...
yes | ${ANDROID_HOME}/cmdline-tools/latest/bin/sdkmanager --install platform-tools emulator

echo Installing platform SDK...
yes | ${ANDROID_HOME}/cmdline-tools/latest/bin/sdkmanager --install "platforms;android-35"

echo Starting ADB...
${ANDROID_HOME}/platform-tools/adb devices
