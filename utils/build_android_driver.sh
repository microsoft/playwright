#!/bin/bash

(cd src/server/android/driver ; ./gradlew assemble)
if [ "$?" -ne "0" ]; then
  exit 1
fi

(cd src/server/android/driver ; ./gradlew assembleAndroidTest)
if [ "$?" -ne "0" ]; then
  exit 1
fi

# These should be uploaded to the CDN
# cp src/server/android/driver/app/build/outputs/apk/debug/app-debug.apk ./bin/android-driver-target.apk
# cp src/server/android/driver/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk ./bin/android-driver.apk
