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
import url from 'url';
import path from 'path';
import https from 'https';

const currentFilePath = url.fileURLToPath(import.meta.url);
// Docker images and the language ports install the Node.js version from this file.
const packageJSONPath = path.join(path.dirname(currentFilePath), '../../packages/playwright-core/package.json');

const latestNodeJsLts = await getLatestNodeJsVersion();
const packageJSON = JSON.parse(await fs.promises.readFile(packageJSONPath, 'utf8'));
if (packageJSON.playwright.nodeVersion !== latestNodeJsLts) {
  packageJSON.playwright.nodeVersion = latestNodeJsLts;
  await fs.promises.writeFile(packageJSONPath, JSON.stringify(packageJSON, null, 2) + '\n');
  console.log(`Updated ${path.relative(process.cwd(), packageJSONPath)} to Node.js ${latestNodeJsLts}`);
}

function getLatestNodeJsVersion() {
  return new Promise((resolve, reject) => {
    https.get('https://nodejs.org/dist/index.json', res => {
      let content = '';
      res.on('data', chunk => content += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200)
          reject(new Error(`Failed to get nodejs version, status code: ${res.statusCode}`));
        const version = JSON.parse(content);
        const latestLts = version.find(release => release.lts);
        resolve(latestLts.version.slice(1));
      });
    });
  });
}
