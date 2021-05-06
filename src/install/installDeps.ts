/**
 * Copyright (c) Microsoft Corporation.
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

import childProcess from 'child_process';
import os from 'os';
import { getUbuntuVersion } from '../utils/ubuntuVersion';

const { deps } = require('../nativeDeps');

export async function installDeps(browserTypes: string[]) {
  if (os.platform() !== 'linux')
    return;
  if (!browserTypes.length)
    browserTypes = ['chromium', 'firefox', 'webkit'];
  browserTypes.push('tools');

  const ubuntuVersion = await getUbuntuVersion();
  if (ubuntuVersion !== '18.04' && ubuntuVersion !== '20.04' && ubuntuVersion !== '21.04') {
    console.warn('Cannot install dependencies for this linux distribution!');  // eslint-disable-line no-console
    return;
  }

  const libraries: string[] = [];
  for (const browserType of browserTypes) {
    if (ubuntuVersion === '18.04')
      libraries.push(...deps['bionic'][browserType]);
    else if (ubuntuVersion === '20.04')
      libraries.push(...deps['focal'][browserType]);
    else if (ubuntuVersion === '21.04')
      libraries.push(...deps['hirsute'][browserType]);
  }
  const uniqueLibraries = Array.from(new Set(libraries));
  console.log('Installing Ubuntu dependencies...');  // eslint-disable-line no-console
  const commands: string[] = [];
  commands.push('apt-get update');
  commands.push(['apt-get', 'install', '-y', '--no-install-recommends',
    ...uniqueLibraries,
  ].join(' '));
  const isRoot = (process.getuid() === 0);
  const child = isRoot ?
    childProcess.spawn('sh', ['-c', `${commands.join('; ')}`], { stdio: 'inherit' }) :
    childProcess.spawn('sudo', ['--', 'sh', '-c', `${commands.join('; ')}`], { stdio: 'inherit' });
  await new Promise(f => child.on('exit', f));
}
