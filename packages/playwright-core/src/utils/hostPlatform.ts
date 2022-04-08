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

import os from 'os';
import { getUbuntuVersionSync } from './ubuntuVersion';

export type HostPlatform = 'win64' |
                           'mac10.13' |
                           'mac10.14' |
                           'mac10.15' |
                           'mac11' | 'mac11-arm64' |
                           'mac12' | 'mac12-arm64' |
                           'ubuntu18.04' | 'ubuntu18.04-arm64' |
                           'ubuntu20.04' | 'ubuntu20.04-arm64' |
                           'generic-linux' | 'generic-linux-arm64' |
                           '<unknown>';

export const hostPlatform = ((): HostPlatform => {
  const platform = os.platform();
  if (platform === 'darwin') {
    const ver = os.release().split('.').map((a: string) => parseInt(a, 10));
    let macVersion = '';
    if (ver[0] < 18) {
      // Everything before 10.14 is considered 10.13.
      macVersion = 'mac10.13';
    } else if (ver[0] === 18) {
      macVersion = 'mac10.14';
    } else if (ver[0] === 19) {
      macVersion = 'mac10.15';
    } else {
      // ver[0] >= 20
      const LAST_STABLE_MAC_MAJOR_VERSION = 12;
      // Best-effort support for MacOS beta versions.
      macVersion = 'mac' + Math.min(ver[0] - 9, LAST_STABLE_MAC_MAJOR_VERSION);
      // BigSur is the first version that might run on Apple Silicon.
      if (os.cpus().some(cpu => cpu.model.includes('Apple')))
        macVersion += '-arm64';
    }
    return macVersion as HostPlatform;
  }
  if (platform === 'linux') {
    const archSuffix = os.arch() === 'arm64' ? '-arm64' : '';
    const ubuntuVersion = getUbuntuVersionSync();
    if (!ubuntuVersion)
      return ('generic-linux' + archSuffix) as HostPlatform;
    if (parseInt(ubuntuVersion, 10) <= 19)
      return ('ubuntu18.04' + archSuffix) as HostPlatform;
    return ('ubuntu20.04' + archSuffix) as HostPlatform;
  }
  if (platform === 'win32')
    return 'win64';
  return '<unknown>';
})();
