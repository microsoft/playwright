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

import * as crypto from 'crypto';
import { getFromENV, logPolitely } from '../helper';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import * as removeFolder from 'rimraf';
import * as browserPaths from './browserPaths';
import * as browserFetcher from './browserFetcher';

const fsMkdirAsync = util.promisify(fs.mkdir.bind(fs));
const fsReaddirAsync = util.promisify(fs.readdir.bind(fs));
const fsReadFileAsync = util.promisify(fs.readFile.bind(fs));
const fsExistsAsync = (filePath: string) => fsReadFileAsync(filePath).then(() => true).catch(e => false);
const fsUnlinkAsync = util.promisify(fs.unlink.bind(fs));
const fsWriteFileAsync = util.promisify(fs.writeFile.bind(fs));
const removeFolderAsync = util.promisify(removeFolder);

export async function installBrowsersWithProgressBar(packagePath: string, browserAllowList: string[] = []) {
  const browsersPath = browserPaths.browsersPath(packagePath);
  const linksDir = path.join(browsersPath, '.links');

  if (getFromENV('PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD')) {
    logPolitely('Skipping browsers download because `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` env variable is set');
    return false;
  }
  await fsMkdirAsync(linksDir,  { recursive: true });
  await fsWriteFileAsync(path.join(linksDir, sha1(packagePath)), packagePath);
  await validateCache(packagePath, browsersPath, linksDir, browserAllowList);
}

async function validateCache(packagePath: string, browsersPath: string, linksDir: string, browserAllowList: string[]) {
  // 1. Collect used downloads and package descriptors.
  const usedBrowserPaths: Set<string> = new Set();
  for (const fileName of await fsReaddirAsync(linksDir)) {
    const linkPath = path.join(linksDir, fileName);
    let linkTarget = '';
    try {
      linkTarget = (await fsReadFileAsync(linkPath)).toString();
      const browsersToDownload = await readBrowsersToDownload(linkTarget);
      for (const browser of browsersToDownload) {
        const usedBrowserPath = browserPaths.browserDirectory(browsersPath, browser);
        const browserRevision = parseInt(browser.revision, 10);
        // Old browser installations don't have marker file.
        const shouldHaveMarkerFile = (browser.name === 'chromium' && browserRevision >= 786218) ||
            (browser.name === 'firefox' && browserRevision >= 1128) ||
            (browser.name === 'webkit' && browserRevision >= 1307);
        if (!shouldHaveMarkerFile || (await fsExistsAsync(browserPaths.markerFilePath(browsersPath, browser))))
          usedBrowserPaths.add(usedBrowserPath);
      }
    } catch (e) {
      if (linkTarget)
        logPolitely('Failed to process descriptor at ' + linkTarget);
      await fsUnlinkAsync(linkPath).catch(e => {});
    }
  }

  // 2. Delete all unused browsers.
  let downloadedBrowsers = (await fsReaddirAsync(browsersPath)).map(file => path.join(browsersPath, file));
  downloadedBrowsers = downloadedBrowsers.filter(file => browserPaths.isBrowserDirectory(file));
  const directories = new Set<string>(downloadedBrowsers);
  for (const browserPath of usedBrowserPaths)
    directories.delete(browserPath);
  for (const directory of directories) {
    logPolitely('Removing unused browser at ' + directory);
    await removeFolderAsync(directory).catch(e => {});
  }

  // 3. Install missing browsers for this package.
  const myBrowsersToDownload = await readBrowsersToDownload(packagePath);
  for (const browser of myBrowsersToDownload) {
    if (browserAllowList.length > 0 && !browserAllowList.includes(browser.name))
      continue;

    await browserFetcher.downloadBrowserWithProgressBar(browsersPath, browser);
    await fsWriteFileAsync(browserPaths.markerFilePath(browsersPath, browser), '');
  }
}

async function readBrowsersToDownload(packagePath: string): Promise<browserPaths.BrowserDescriptor[]> {
  const browsers = JSON.parse((await fsReadFileAsync(path.join(packagePath, 'browsers.json'))).toString())['browsers'] as browserPaths.BrowserDescriptor[];
  // Older versions do not have "download" field. We assume they need all browsers
  // from the list. So we want to skip all browsers that are explicitly marked as "download: false".
  return browsers.filter(browser => browser.download !== false);
}

function sha1(data: string): string {
  const sum = crypto.createHash('sha1');
  sum.update(data);
  return sum.digest('hex');
}
