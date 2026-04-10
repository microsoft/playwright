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
                           'mac15' | 'mac15-arm64' |
                           'mac26' | 'mac26-arm64' |
                           'ubuntu18.04-x64' | 'ubuntu18.04-arm64' |
                           'ubuntu20.04-x64' | 'ubuntu20.04-arm64' |
                           'ubuntu22.04-x64' | 'ubuntu22.04-arm64' |
                           'ubuntu24.04-x64' | 'ubuntu24.04-arm64' |
                           'debian11-x64' | 'debian11-arm64' |
                           'debian12-x64' | 'debian12-arm64' |
                           'debian13-x64' | 'debian13-arm64' |
                           'almalinux10-x64' | 'almalinux10-arm64' |
                           '<unknown>';

function calculatePlatform(): { hostPlatform: HostPlatform, isOfficiallySupportedPlatform: boolean } {
  if (process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE) {
    return {
      hostPlatform: process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE as HostPlatform,
      isOfficiallySupportedPlatform: false
    };
  }
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
    } else if (ver[0] < 25) {
      // Darwin 20..24 → macOS 11..15 (BigSur..Sequoia).
      macVersion = 'mac' + (ver[0] - 9);
      // BigSur is the first version that might run on Apple Silicon.
      if (os.cpus().some(cpu => cpu.model.includes('Apple')))
        macVersion += '-arm64';
    } else {
      // Apple jumped from macOS 15 (Sequoia) to macOS 26 (Tahoe), so Darwin 25 = macOS 26.
      // Best-effort support for MacOS beta versions.
      const LAST_STABLE_MACOS_MAJOR_VERSION = 26;
      macVersion = 'mac' + Math.min(ver[0] + 1, LAST_STABLE_MACOS_MAJOR_VERSION);
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
      const isUbuntu = distroInfo?.id === 'ubuntu';
      const version = distroInfo?.version;
      const major = parseInt(distroInfo.version, 10);
      if (major < 20)
        return { hostPlatform: ('ubuntu18.04' + archSuffix) as HostPlatform, isOfficiallySupportedPlatform: false };
      if (major < 22)
        return { hostPlatform: ('ubuntu20.04' + archSuffix) as HostPlatform, isOfficiallySupportedPlatform: isUbuntu && version === '20.04' };
      if (major < 24)
        return { hostPlatform: ('ubuntu22.04' + archSuffix) as HostPlatform, isOfficiallySupportedPlatform: isUbuntu && version === '22.04' };
      if (major < 26)
        return { hostPlatform: ('ubuntu24.04' + archSuffix) as HostPlatform, isOfficiallySupportedPlatform: isUbuntu && version === '24.04' };
      return { hostPlatform: ('ubuntu' + distroInfo.version + archSuffix) as HostPlatform, isOfficiallySupportedPlatform: false };
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
      if (distroInfo?.version === '13')
        return { hostPlatform: ('debian13' + archSuffix) as HostPlatform, isOfficiallySupportedPlatform };
      // use most recent supported release for 'debian testing' and 'unstable'.
      // they never include a numeric version entry in /etc/os-release.
      if (distroInfo?.version === '')
        return { hostPlatform: ('debian13' + archSuffix) as HostPlatform, isOfficiallySupportedPlatform };
    }
    if (distroInfo?.id === 'almalinux') {
      const major = parseInt(distroInfo.version, 10);
      if (major >= 10)
        return { hostPlatform: ('almalinux10' + archSuffix) as HostPlatform, isOfficiallySupportedPlatform: true };
    }
    return { hostPlatform: ('ubuntu24.04' + archSuffix) as HostPlatform, isOfficiallySupportedPlatform: false };
  }
  if (platform === 'win32')
    return { hostPlatform: 'win64', isOfficiallySupportedPlatform: true };
  return { hostPlatform: '<unknown>', isOfficiallySupportedPlatform: false };
}

export const { hostPlatform, isOfficiallySupportedPlatform } = calculatePlatform();

export type ShortPlatform = 'mac-x64' | 'mac-arm64' | 'linux-x64' | 'linux-arm64' | 'win-x64' | '<unknown>';

function toShortPlatform(hostPlatform: HostPlatform): ShortPlatform {
  if (hostPlatform === '<unknown>')
    return '<unknown>';
  if (hostPlatform === 'win64')
    return 'win-x64';
  if (hostPlatform.startsWith('mac'))
    return hostPlatform.endsWith('arm64') ? 'mac-arm64' : 'mac-x64';
  return hostPlatform.endsWith('arm64') ? 'linux-arm64' : 'linux-x64';
}

export const shortPlatform = toShortPlatform(hostPlatform);
