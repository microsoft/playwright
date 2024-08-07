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
import { getLinuxDistributionInfoSync } from './linuxUtils';

export type HostPlatform = 'win64' |
                           'mac10.13' |
                           'mac10.14' |
                           'mac10.15' |
                           'mac11' | 'mac11-arm64' |
                           'mac12' | 'mac12-arm64' |
                           'mac13' | 'mac13-arm64' |
                           'mac14' | 'mac14-arm64' |
                           'ubuntu18.04-x64' | 'ubuntu18.04-arm64' |
                           'ubuntu20.04-x64' | 'ubuntu20.04-arm64' |
                           'ubuntu22.04-x64' | 'ubuntu22.04-arm64' |
                           'ubuntu24.04-x64' | 'ubuntu24.04-arm64' |
                           'debian11-x64' | 'debian11-arm64' |
                           'debian12-x64' | 'debian12-arm64' |
                           '<unknown>';

function calculatePlatform(): { hostPlatform: HostPlatform, isOfficiallySupportedPlatform: boolean } {
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
      const LAST_STABLE_MAC_MAJOR_VERSION = 14;
      // Best-effort support for MacOS beta versions.
      macVersion = 'mac' + Math.min(ver[0] - 9, LAST_STABLE_MAC_MAJOR_VERSION);
      // BigSur is the first version that might run on Apple Silicon.
      if (os.cpus().some(cpu => cpu.model.includes('Apple')))
        macVersion += '-arm64';
    }
    return { hostPlatform: macVersion as HostPlatform, isOfficiallySupportedPlatform: true };
  }
  if (platform === 'linux') {
    if (!['x64', 'arm64'].includes(os.arch()))
      return { hostPlatform: '<unknown>', isOfficiallySupportedPlatform: false };

    const archSuffix = '-' + os.arch();
    const distroInfo = getLinuxDistributionInfoSync();

    // Pop!_OS is ubuntu-based and has the same versions.
    // KDE Neon is ubuntu-based and has the same versions.
    // TUXEDO OS is ubuntu-based and has the same versions.
    if (distroInfo?.id === 'ubuntu' || distroInfo?.id === 'pop' || distroInfo?.id === 'neon' || distroInfo?.id === 'tuxedo') {
      const isOfficiallySupportedPlatform = distroInfo?.id === 'ubuntu';
      if (parseInt(distroInfo.version, 10) <= 19)
        return { hostPlatform: ('ubuntu18.04' + archSuffix) as HostPlatform, isOfficiallySupportedPlatform: false };
      if (parseInt(distroInfo.version, 10) <= 21)
        return { hostPlatform: ('ubuntu20.04' + archSuffix) as HostPlatform, isOfficiallySupportedPlatform };
      if (parseInt(distroInfo.version, 10) <= 22)
        return { hostPlatform: ('ubuntu22.04' + archSuffix) as HostPlatform, isOfficiallySupportedPlatform };
      return { hostPlatform: ('ubuntu24.04' + archSuffix) as HostPlatform, isOfficiallySupportedPlatform };
    }
    // Linux Mint is ubuntu-based but does not have the same versions
    if (distroInfo?.id === 'linuxmint') {
      const mintMajor = parseInt(distroInfo.version, 10);
      if (mintMajor <= 20)
        return { hostPlatform: ('ubuntu20.04' + archSuffix) as HostPlatform, isOfficiallySupportedPlatform: false };
      if (mintMajor === 21)
        return { hostPlatform: ('ubuntu22.04' + archSuffix) as HostPlatform, isOfficiallySupportedPlatform: false };
      return { hostPlatform: ('ubuntu24.04' + archSuffix) as HostPlatform, isOfficiallySupportedPlatform: false };
    }
    if (distroInfo?.id === 'debian' || distroInfo?.id === 'raspbian') {
      const isOfficiallySupportedPlatform = distroInfo?.id === 'debian';
      if (distroInfo?.version === '11')
        return { hostPlatform: ('debian11' + archSuffix) as HostPlatform, isOfficiallySupportedPlatform };
      if (distroInfo?.version === '12')
        return { hostPlatform: ('debian12' + archSuffix) as HostPlatform, isOfficiallySupportedPlatform };
      // use most recent supported release for 'debian testing' and 'unstable'.
      // they never include a numeric version entry in /etc/os-release.
      if (distroInfo?.version === '')
        return { hostPlatform: ('debian12' + archSuffix) as HostPlatform, isOfficiallySupportedPlatform };
    }
    return { hostPlatform: ('ubuntu20.04' + archSuffix) as HostPlatform, isOfficiallySupportedPlatform: false };
  }
  if (platform === 'win32')
    return { hostPlatform: 'win64', isOfficiallySupportedPlatform: true };
  return { hostPlatform: '<unknown>', isOfficiallySupportedPlatform: false };
}

export const { hostPlatform, isOfficiallySupportedPlatform } = calculatePlatform();
