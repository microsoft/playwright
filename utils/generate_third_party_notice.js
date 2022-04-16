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

const checker = require('license-checker');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

(async () => {
  for (const project of ['playwright-core', 'playwright-test']) {
    const lines = [];
    lines.push(`microsoft/${project}

THIRD-PARTY SOFTWARE NOTICES AND INFORMATION

This project incorporates components from the projects listed below. The original copyright notices and the licenses under which Microsoft received such components are set forth below. Microsoft reserves all rights not expressly granted herein, whether by implication, estoppel or otherwise.
`);

    const allPackages = {};
    const projectDir = path.join(__dirname, '..', 'packages', project);
    const bundlesDir = path.join(projectDir, 'bundles');
    for (const bundle of fs.readdirSync(bundlesDir)) {
      const dir = path.join(bundlesDir, bundle);
      execSync('npm ci', { cwd: dir });
      const packages = await new Promise((f, r) => {
        checker.init({
          start: dir,
          production: true,
          customPath: {
            licenseText: '',
          }
        }, function(err, packages) {
          if (err)
            r(err);
          else
            f(packages);
        });
      });  
      for (const [key, value] of Object.entries(packages)) {
        if (value.licenseText)
          allPackages[key] = value;
      }
    }

    let i = 0;
    for (const [key, value] of Object.entries(allPackages))
      lines.push(`${++i}.\t${key} (${value.repository})`);
  
    i = 0;
    for (const [key, value] of Object.entries(allPackages)) {
      lines.push(`\n%% ${key} NOTICES AND INFORMATION BEGIN HERE`);
      lines.push(`=========================================`);
      lines.push(value.licenseText);
      lines.push(`=========================================`);
      lines.push(`END OF ${key} AND INFORMATION`);
    }
  
    fs.writeFileSync(path.join(projectDir, 'ThirdPartyNotices.txt'), lines.join('\n').replace(/\r\n/g, '\n'));
  }
})();
