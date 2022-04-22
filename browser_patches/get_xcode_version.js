#!/usr/bin/env node

const child_process = require('child_process');

const XCODE_VERSIONS = {
  "macos-10.15": {
      webkit: '11.7',
  },
  "macos-11": {
      webkit: '12.5', // WebKit strongly requires xcode 12.5 and not higher on MacOS 11
     firefox: '13.2', // As of Oct 2021 building Firefox requires XCode 13
      ffmpeg: '13.2',
  },
  "macos-12": {
      webkit: '13.3',
     firefox: '13.2', // As of Oct 2021 building Firefox requires XCode 13
    chromium: '13.3', // As of Apr 2022 Chromium requires Xcode13.3
      ffmpeg: '13.2',
  },
};

const [major, minor, patch] = child_process.execSync(`sw_vers -productVersion`).toString().trim().split('.');
const browserName = process.argv[2];
const macosVersion = major === '10' ? `macos-${major}.${minor}` : `macos-${major}`;
const versions = XCODE_VERSIONS[macosVersion];
if (!versions || !versions[browserName.toLowerCase()])
  throw new Error(`Compilation of ${browserName} is not supported on ${macosVersion}`);

console.log(versions[browserName.toLowerCase()]);

