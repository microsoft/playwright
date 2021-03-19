/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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

const fs = require('fs');

const { deps } = require('../../lib/nativeDeps');
for (const distro in deps) {
  const file = fs.readFileSync(require.resolve(`./Dockerfile.${distro}`), 'utf-8');
  const newContent = [];
  newContent.push('# === GENERATED BROWSER DEPENDENCIES ===');
  newContent.push('');
  newContent.push('# (generated with ./updateDockerDeps.js)');
  for (const browser in deps[distro]) {
    newContent.push('');
    newContent.push(`# ${browser}`);
    newContent.push(`RUN apt-get update && apt-get install -y --no-install-recommends \\`);
    newContent.push('    ' + deps[distro][browser].join('\\\n    '));
  }
  newContent.push('');
  newContent.push('# === GENERATED BROWSER DEPENDENCIES END ===');
  const result = file.replace(/# === GENERATED BROWSER DEPENDENCIES ===[.\s\S]*# === GENERATED BROWSER DEPENDENCIES END ===/g, newContent.join('\n'));
  console.log(`Updating Dockerfile.${distro}`);
  fs.writeFileSync(require.resolve(`./Dockerfile.${distro}`), result);
}
