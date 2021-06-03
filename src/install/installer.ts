/**
 * Copyright Microsoft Corporation. All rights reserved.
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

import fs from 'fs';
import path from 'path';
import lockfile from 'proper-lockfile';
import {Registry, allBrowserNames, isBrowserDirectory, BrowserName, registryDirectory} from '../utils/registry';
import * as browserFetcher from './browserFetcher';
import { getAsBooleanFromENV, calculateSha1, removeFolders } from '../utils/utils';

const fsExistsAsync = (filePath: string) => fs.promises.readFile(filePath).then(() => true).catch(e => false);

const PACKAGE_PATH = path.join(__dirname, '..', '..');

export async function installBrowsersWithProgressBar(browserNames: BrowserName[] = Registry.currentPackageRegistry().installByDefault()) {
  // PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD should have a value of 0 or 1
  if (getAsBooleanFromENV('PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD')) {
    browserFetcher.logPolitely('Skipping browsers download because `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` env variable is set');
    return false;
  }

  await fs.promises.mkdir(registryDirectory, { recursive: true });
  const lockfilePath = path.join(registryDirectory, '__dirlock');
  const releaseLock = await lockfile.lock(registryDirectory, {
    retries: {
      retries: 10,
      // Retry 20 times during 10 minutes with
      // exponential back-off.
      // See documentation at: https://www.npmjs.com/package/retry#retrytimeoutsoptions
      factor: 1.27579,
    },
    onCompromised: (err: Error) => {
      throw new Error(`${err.message} Path: ${lockfilePath}`);
    },
    lockfilePath,
  });
  const linksDir = path.join(registryDirectory, '.links');

  try {
    await fs.promises.mkdir(linksDir,  { recursive: true });
    await fs.promises.writeFile(path.join(linksDir, calculateSha1(PACKAGE_PATH)), PACKAGE_PATH);
    await validateCache(linksDir, browserNames);
  } finally {
    await releaseLock();
  }
}

async function validateCache(linksDir: string, browserNames: BrowserName[]) {
  // 1. Collect used downloads and package descriptors.
  const usedBrowserPaths: Set<string> = new Set();
  for (const fileName of await fs.promises.readdir(linksDir)) {
    const linkPath = path.join(linksDir, fileName);
    let linkTarget = '';
    try {
      linkTarget = (await fs.promises.readFile(linkPath)).toString();
      const linkRegistry = new Registry(linkTarget);
      for (const browserName of allBrowserNames) {
        if (!linkRegistry.isSupportedBrowser(browserName))
          continue;
        const usedBrowserPath = linkRegistry.browserDirectory(browserName);
        const browserRevision = linkRegistry.revision(browserName);
        // Old browser installations don't have marker file.
        const shouldHaveMarkerFile = (browserName === 'chromium' && browserRevision >= 786218) ||
            (browserName === 'firefox' && browserRevision >= 1128) ||
            (browserName === 'webkit' && browserRevision >= 1307) ||
            // All new applications have a marker file right away.
            (browserName !== 'firefox' && browserName !== 'chromium' && browserName !== 'webkit');
        if (!shouldHaveMarkerFile || (await fsExistsAsync(markerFilePath(usedBrowserPath))))
          usedBrowserPaths.add(usedBrowserPath);
      }
    } catch (e) {
      await fs.promises.unlink(linkPath).catch(e => {});
    }
  }

  // 2. Delete all unused browsers.
  if (!getAsBooleanFromENV('PLAYWRIGHT_SKIP_BROWSER_GC')) {
    let downloadedBrowsers = (await fs.promises.readdir(registryDirectory)).map(file => path.join(registryDirectory, file));
    downloadedBrowsers = downloadedBrowsers.filter(file => isBrowserDirectory(file));
    const directories = new Set<string>(downloadedBrowsers);
    for (const browserDirectory of usedBrowserPaths)
      directories.delete(browserDirectory);
    for (const directory of directories)
      browserFetcher.logPolitely('Removing unused browser at ' + directory);
    await removeFolders([...directories]);
  }

  // 3. Install missing browsers for this package.
  const myRegistry = Registry.currentPackageRegistry();
  for (const browserName of browserNames) {
    await browserFetcher.downloadBrowserWithProgressBar(myRegistry, browserName).catch(e => {
      throw new Error(`Failed to download ${browserName}, caused by\n${e.stack}`);
    });
    await fs.promises.writeFile(markerFilePath(myRegistry.browserDirectory(browserName)), '');
  }
}

function markerFilePath(browserDirectory: string): string {
  return path.join(browserDirectory, 'INSTALLATION_COMPLETE');
}

