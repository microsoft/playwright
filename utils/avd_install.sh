#!/bin/bash

set -e

SDKDIR=$PWD/.android-sdk
export ANDROID_SDK_ROOT=${SDKDIR}
export ANDROID_HOME=${SDKDIR}
export ANDROID_AVD_HOME=${SDKDIR}/avd

mkdir ${SDKDIR}
mkdir ${SDKDIR}/cmdline-tools

echo Downloading Android SDK...
cd ${SDKDIR}/cmdline-tools
COMMAND_LINE_TOOLS_ZIP=${SDKDIR}/commandlinetools.zip
# https://developer.android.com/studio#command-tools
curl https://dl.google.com/android/repository/commandlinetools-mac-8512546_latest.zip -o ${COMMAND_LINE_TOOLS_ZIP}
unzip ${COMMAND_LINE_TOOLS_ZIP}
rm ${COMMAND_LINE_TOOLS_ZIP}
mv cmdline-tools latest
ln -s ${SDKDIR}/cmdline-tools/latest ${SDKDIR}/tools

echo Installing emulator...
yes | ${ANDROID_HOME}/tools/bin/sdkmanager --install platform-tools emulator

echo Installing platform SDK...
yes | ${ANDROID_HOME}/tools/bin/sdkmanager --install "platforms;android-33"

echo Starting ADB...
${ANDROID_HOME}/platform-tools/adb devices
