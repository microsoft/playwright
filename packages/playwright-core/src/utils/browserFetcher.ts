/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import extract from 'extract-zip';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { existsAsync, download, getPlaywrightVersion } from './utils';
import { debugLogger } from './debugLogger';
import { parseOSReleaseText } from './ubuntuVersion';

export async function downloadBrowserWithProgressBar(title: string, browserDirectory: string, executablePath: string, downloadURL: string, downloadFileName: string): Promise<boolean> {
  const progressBarName = `Playwright build of ${title}`;
  if (await existsAsync(browserDirectory)) {
    // Already downloaded.
    debugLogger.log('install', `browser ${title} is already downloaded.`);
    return false;
  }

  const url = downloadURL;
  const zipPath = path.join(os.tmpdir(), downloadFileName);
  try {
    await download(url, zipPath, {
      progressBarName,
      log: debugLogger.log.bind(debugLogger, 'install'),
      userAgent: getDownloadUserAgent(),
    });
    debugLogger.log('install', `extracting archive`);
    debugLogger.log('install', `-- zip: ${zipPath}`);
    debugLogger.log('install', `-- location: ${browserDirectory}`);
    await extract(zipPath, { dir: browserDirectory });
    debugLogger.log('install', `fixing permissions at ${executablePath}`);
    await fs.promises.chmod(executablePath, 0o755);
  } catch (e) {
    debugLogger.log('install', `FAILED installation ${progressBarName} with error: ${e}`);
    process.exitCode = 1;
    throw e;
  } finally {
    if (await existsAsync(zipPath))
      await fs.promises.unlink(zipPath);
  }
  logPolitely(`${progressBarName} downloaded to ${browserDirectory}`);
  return true;
}


export function logPolitely(toBeLogged: string) {
  const logLevel = process.env.npm_config_loglevel;
  const logLevelDisplay = ['silent', 'error', 'warn'].indexOf(logLevel || '') > -1;

  if (!logLevelDisplay)
    console.log(toBeLogged);  // eslint-disable-line no-console
}

let cachedUserAgent: string | undefined;
function getDownloadUserAgent(): string {
  if (cachedUserAgent)
    return cachedUserAgent;
  try {
    cachedUserAgent = determineDownloadUserAgent();
  } catch (e) {
    cachedUserAgent = 'Playwright/unknown';
  }
  return cachedUserAgent;
}

function determineDownloadUserAgent(): string {
  let osIdentifier = 'unknown';
  let osVersion = 'unknown';
  if (process.platform === 'win32') {
    const version = os.release().split('.');
    osIdentifier = 'windows';
    osVersion = `${version[0]}.${version[1]}`;
  } else if (process.platform === 'darwin') {
    const version = execSync('sw_vers -productVersion').toString().trim().split('.');
    osIdentifier = 'macOS';
    osVersion = `${version[0]}.${version[1]}`;
  } else if (process.platform === 'linux') {
    try {
      const osReleaseText = fs.readFileSync('/etc/os-release', 'utf8');
      const fields = parseOSReleaseText(osReleaseText);
      osIdentifier = fields.get('id') || 'unknown';
      osVersion = fields.get('version_id') || 'unknown';
    } catch (e) {
    }
  }

  let langName = 'unknown';
  let langVersion = 'unknown';
  if (!process.env.PW_CLI_TARGET_LANG) {
    langName = 'node';
    langVersion = process.version.substring(1).split('.').slice(0, 2).join('.');
  } else if (['node', 'python', 'java', 'csharp'].includes(process.env.PW_CLI_TARGET_LANG)) {
    langName = process.env.PW_CLI_TARGET_LANG;
    langVersion = process.env.PW_CLI_TARGET_LANG_VERSION ?? 'unknown';
  }

  return `Playwright/${getPlaywrightVersion()} (${os.arch()}; ${osIdentifier} ${osVersion}) ${langName}/${langVersion}`;
}
