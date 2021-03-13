/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from 'fs';
import path from 'path';

function darwin(channel: string): string | undefined {
  switch (channel) {
    case 'chrome': return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    case 'chrome-canary': return '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary';
    case 'msedge': return '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
    case 'msedge-beta': return '/Applications/Microsoft Edge Beta.app/Contents/MacOS/Microsoft Edge Beta';
    case 'msedge-dev': return '/Applications/Microsoft Edge Dev.app/Contents/MacOS/Microsoft Edge Dev';
    case 'msedge-canary': return '/Applications/Microsoft Edge Canary.app/Contents/MacOS/Microsoft Edge Canary';
  }
}

function linux(channel: string): string | undefined {
  switch (channel) {
    case 'chrome': return '/opt/google/chrome/chrome';
    case 'chrome-beta': return '/opt/google/chrome-beta/chrome';
    case 'chrome-dev': return '/opt/google/chrome-unstable/chrome';
    case 'msedge-dev': return '/opt/microsoft/msedge-dev/msedge';
  }
}

function win32(channel: string): string | undefined {
  let suffix: string | undefined;
  switch (channel) {
    case 'chrome': suffix = `\\Google\\Chrome\\Application\\chrome.exe`; break;
    case 'chrome-canary': suffix = `\\Google\\Chrome SxS\\Application\\chrome.exe`; break;
    case 'msedge': suffix = `\\Microsoft\\Edge\\Application\\msedge.exe`; break;
    case 'msedge-beta': suffix = `\\Microsoft\\Edge Beta\\Application\\msedge.exe`; break;
    case 'msedge-dev': suffix = `\\Microsoft\\Edge Dev\\Application\\msedge.exe`; break;
    case 'msedge-canary': suffix = `\\Microsoft\\Edge SxS\\Application\\msedge.exe`; break;
  }
  if (!suffix)
    return;
  const prefixes = [
    process.env.LOCALAPPDATA, process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)']
  ].filter(Boolean) as string[];

  let result: string | undefined;
  prefixes.forEach(prefix => {
    const chromePath = path.join(prefix, suffix!);
    if (canAccess(chromePath))
      result = chromePath;
  });
  return result;
}

function canAccess(file: string) {
  if (!file)
    return false;

  try {
    fs.accessSync(file);
    return true;
  } catch (e) {
    return false;
  }
}

export function findChromiumChannel(channel: string): string {
  let result: string | undefined;
  if (process.platform === 'linux')
    result = linux(channel);
  else if (process.platform === 'win32')
    result = win32(channel);
  else if (process.platform === 'darwin')
    result = darwin(channel);

  if (!result)
    throw new Error(`Chromium distribution '${channel}' is not supported on ${process.platform}`);

  if (canAccess(result))
    return result;
  throw new Error(`Chromium distribution was not found: ${channel}`);
}
