#!/bin/bash

SDKDIR=$PWD/.android-sdk
export ANDROID_SDK_ROOT=${SDKDIR}
export ANDROID_HOME=${SDKDIR}
export ANDROID_AVD_HOME=${SDKDIR}/avd

mkdir ${SDKDIR}
mkdir ${SDKDIR}/cmdline-tools

echo Downloading Android SDK...
cd ${SDKDIR}/cmdline-tools
curl https://dl.google.com/android/repository/commandlinetools-mac-6858069_latest.zip -o commandlinetools-mac-6858069_latest.zip
unzip commandlinetools-mac-6858069_latest.zip
mv cmdline-tools latest

echo Installing emulator...
yes | ${SDKDIR}/cmdline-tools/latest/bin/sdkmanager platform-tools emulator

echo Installing system image...
${SDKDIR}/cmdline-tools/latest/bin/sdkmanager "system-images;android-30;google_apis;x86"

echo Installing platform SDK...
${SDKDIR}/cmdline-tools/latest/bin/sdkmanager "platforms;android-30"

echo Starting ADB...
${SDKDIR}/platform-tools/adb devices
