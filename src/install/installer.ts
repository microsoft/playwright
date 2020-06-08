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
import * as browserPaths from '../install/browserPaths';
import * as browserFetcher from '../install/browserFetcher';

const fsMkdirAsync = util.promisify(fs.mkdir.bind(fs));
const fsReaddirAsync = util.promisify(fs.readdir.bind(fs));
const fsReadFileAsync = util.promisify(fs.readFile.bind(fs));
const fsUnlinkAsync = util.promisify(fs.unlink.bind(fs));
const fsWriteFileAsync = util.promisify(fs.writeFile.bind(fs));
const rmAsync = util.promisify(removeFolder);

export async function installBrowsersWithProgressBar(packagePath: string) {
  const browsersPath = browserPaths.browsersPath(packagePath);
  const linksDir = path.join(browsersPath, '.links');

  if (getFromENV('PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD')) {
    logPolitely('Skipping browsers download because `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` env variable is set');
    return false;
  }
  await fsMkdirAsync(linksDir,  { recursive: true });
  await fsWriteFileAsync(path.join(linksDir, sha1(packagePath)), packagePath);
  await validateCache(packagePath, browsersPath, linksDir);
}

async function validateCache(packagePath: string, browsersPath: string, linksDir: string) {
  // 1. Collect unused downloads and package descriptors.
  const allBrowsers: browserPaths.BrowserDescriptor[] = [];
  for (const fileName of await fsReaddirAsync(linksDir)) {
    const linkPath = path.join(linksDir, fileName);
    let linkTarget = '';
    try {
      linkTarget = (await fsReadFileAsync(linkPath)).toString();
      const browsers = JSON.parse((await fsReadFileAsync(path.join(linkTarget, 'browsers.json'))).toString())['browsers'];
      allBrowsers.push(...browsers);
    } catch (e) {
      if (linkTarget)
        logPolitely('Failed to process descriptor at ' + linkTarget);
      await fsUnlinkAsync(linkPath).catch(e => {});
    }
  }

  // 2. Delete all stale browser extract directories and .zip files.
  // NOTE: this must not run concurrently with other installations.
  let staleFiles = (await fsReaddirAsync(browsersPath)).map(file => path.join(browsersPath, file));
  staleFiles = staleFiles.filter(file => browserPaths.isBrowserZipFile(file) || browserPaths.isBrowserExtractDirectory(file));
  for (const staleFile of staleFiles)
    await rmAsync(staleFile).catch(e => {});

  // 3. Delete all unused browsers.
  let downloadedBrowsers = (await fsReaddirAsync(browsersPath)).map(file => path.join(browsersPath, file));
  downloadedBrowsers = downloadedBrowsers.filter(file => browserPaths.isBrowserDirectory(file));
  const directories = new Set<string>(downloadedBrowsers);
  for (const browser of allBrowsers)
    directories.delete(browserPaths.browserDirectory(browsersPath, browser));
  for (const directory of directories) {
    logPolitely('Removing unused browser at ' + directory);
    await rmAsync(directory).catch(e => {});
  }

  // 4. Install missing browsers for this package.
  const myBrowsers = JSON.parse((await fsReadFileAsync(path.join(packagePath, 'browsers.json'))).toString())['browsers'] as browserPaths.BrowserDescriptor[];
  for (const browser of myBrowsers) {
    const browserPath = browserPaths.browserDirectory(browsersPath, browser);
    await browserFetcher.downloadBrowserWithProgressBar(browserPath, browser);
  }
}

function sha1(data: string): string {
  const sum = crypto.createHash('sha1');
  sum.update(data);
  return sum.digest('hex');
}
