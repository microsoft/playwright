/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from 'fs';
import path from 'path';
import extract from 'extract-zip';

async function downloadFile(urlString: string, filePath: string) {
  console.log(`Downloading ${urlString} to ${filePath}`);
  const { error } = await require('../../lib/utils/utils').downloadFile(urlString, filePath, {});
  if (error)
    throw error;
}

const assets = path.join(__dirname, '..', 'assets');
const downloadDir = path.join(assets, 'selenium-grid');
export const standalone314159 = path.join(downloadDir, 'standalone-3.141.59.jar');
export const selenium400rc1 = path.join(downloadDir, 'selenium-4.0.0-rc-1.jar');
export const chromeDriver = path.join(downloadDir, process.platform === 'win32' ? 'chromedriver.exe' : 'chromedriver');
const chromeDriverZip = path.join(downloadDir, 'chromedriver.zip');

export default async () => {
  await fs.promises.mkdir(assets, { recursive: true });
  if (!fs.existsSync(standalone314159))
    await downloadFile('https://github.com/SeleniumHQ/selenium/releases/download/selenium-3.141.59/selenium-server-standalone-3.141.59.jar', standalone314159);
  if (!fs.existsSync(selenium400rc1))
    await downloadFile('https://github.com/SeleniumHQ/selenium/releases/download/selenium-4.0.0-rc-1/selenium-server-4.0.0-rc-1.jar', selenium400rc1);
  if (!fs.existsSync(chromeDriver)) {
    const chromeDriverPlatform = {
      'linux': 'linux64',
      'darwin': 'mac64',
      'win32': 'win32',
    }[process.platform];
    await downloadFile(`https://chromedriver.storage.googleapis.com/93.0.4577.63/chromedriver_${chromeDriverPlatform}.zip`, chromeDriverZip);
    await extract(chromeDriverZip, { dir: path.dirname(chromeDriver) });
    await fs.promises.chmod(chromeDriver, 0o755);
  }
};
