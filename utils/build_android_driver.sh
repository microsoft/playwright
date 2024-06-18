#!/usr/bin/env bash

(cd packages/playwright-core/src/server/android/driver ; ./gradlew assemble)
if [ "$?" -ne "0" ]; then
  exit 1
fi

(cd packages/playwright-core/src/server/android/driver ; ./gradlew assembleAndroidTest)
if [ "$?" -ne "0" ]; then
  exit 1
fi

# These should be uploaded to the CDN
mkdir -p for-cdn
cp packages/playwright-core/src/server/android/driver/app/build/outputs/apk/debug/app-debug.apk ./for-cdn/android-driver-target.apk
cp packages/playwright-core/src/server/android/driver/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk ./for-cdn/android-driver.apk
cd for-cdn
zip /tmp/android.zip *.apk
cd ..
rm -r for-cdn
echo "Android driver APKs are in /tmp/android.zip. Upload them to the CDN."

