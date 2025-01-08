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

import { registry } from '../../server';
import { gracefullyProcessExitDoNotHang } from '../../utils';

async function listInstalledBrowsers() {
  try {
    const executables = registry.executables();
    for (const executable of executables) {
      if (executable.installType !== 'none') {
        console.log(`Browser: ${executable.name}`);
        console.log(`  Version: ${executable.browserVersion}`);
        console.log(`  Install location: ${executable.directory}`);
        console.log('');
      }
    }
  } catch (e) {
    console.error(`Failed to list installed browsers\n${e}`);
    gracefullyProcessExitDoNotHang(1);
  }
}

export { listInstalledBrowsers };
