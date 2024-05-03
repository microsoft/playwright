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

const requireName = process.argv[2];
const success = process.argv.slice(3);

const playwright = require(requireName);
const fs = require('fs');

(async () => {
  for (const browserType of success) {
    try {
      const browser = await playwright[browserType].launch({});
      const context = await browser.newContext({
        recordVideo: { dir: __dirname, size: {width: 320, height: 240} },
      });
      await context.newPage();
      // Wait for 1 second to actually record something.
      await new Promise(x => setTimeout(x, 1000));
      await context.close();
      await browser.close();
      const videoFile = fs.readdirSync(__dirname).find(name => name.endsWith('webm'));
      if (!videoFile) {
        console.error(`ERROR: Package "${requireName}", browser "${browserType}" should have created screencast!`);
        process.exit(1);
      }
    } catch (err) {
      console.error(`ERROR: Should be able to launch ${browserType} from ${requireName}`);
      console.error(err);
      process.exit(1);
    }
  }
})();
