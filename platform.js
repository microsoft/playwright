const os = require('os');
const fs = require('fs');

let didFailToReadOSRelease = false;
let osRelease;
// let osRelease: {
//   id: string,
//   version: string,
// } | undefined;

async function getLinuxDistributionInfo() {
  if (process.platform !== 'linux')
    return undefined;
  if (!osRelease && !didFailToReadOSRelease) {
    try {
      // List of /etc/os-release values for different distributions could be
      // found here: https://gist.github.com/aslushnikov/8ceddb8288e4cf9db3039c02e0f4fb75
      const osReleaseText = await fs.promises.readFile('/etc/os-release', 'utf8');
      const fields = parseOSReleaseText(osReleaseText);
      osRelease = {
        id: fields.get('id') ?? '',
        version: fields.get('version_id') ?? '',
      };
    } catch (e) {
      didFailToReadOSRelease = true;
    }
  }
  return osRelease;
}

function getLinuxDistributionInfoSync() {
  if (process.platform !== 'linux')
    return undefined;
  if (!osRelease && !didFailToReadOSRelease) {
    try {
      // List of /etc/os-release values for different distributions could be
      // found here: https://gist.github.com/aslushnikov/8ceddb8288e4cf9db3039c02e0f4fb75
      const osReleaseText = fs.readFileSync('/etc/os-release', 'utf8');
      const fields = parseOSReleaseText(osReleaseText);
      osRelease = {
        id: fields.get('id') ?? '',
        version: fields.get('version_id') ?? '',
      };
    } catch (e) {
      didFailToReadOSRelease = true;
    }
  }
  return osRelease;
}

function parseOSReleaseText(osReleaseText) {
  const fields = new Map();
  for (const line of osReleaseText.split('\n')) {
    const tokens = line.split('=');
    const name = tokens.shift();
    let value = tokens.join('=').trim();
    if (value.startsWith('"') && value.endsWith('"'))
      value = value.substring(1, value.length - 1);
    if (!name)
      continue;
    fields.set(name.toLowerCase(), value);
  }
  return fields;
}

const hostPlatform = (() => {
  const platform = os.platform();
  if (platform === 'darwin') {
    const ver = os.release().split('.').map((a) => parseInt(a, 10));
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
    return macVersion;
  }
  if (platform === 'linux') {
    const archSuffix = os.arch() === 'arm64' ? '-arm64' : '';
    const distroInfo = getLinuxDistributionInfoSync();

    // Pop!_OS is ubuntu-based and has the same versions.
    if (distroInfo?.id === 'ubuntu' || distroInfo?.id === 'pop') {
      if (parseInt(distroInfo.version, 10) <= 19)
        return ('ubuntu18.04' + archSuffix);
      if (parseInt(distroInfo.version, 10) <= 21)
        return ('ubuntu20.04' + archSuffix);
      return ('ubuntu22.04' + archSuffix);
    }
    if (distroInfo?.id === 'debian' && distroInfo?.version === '11' && !archSuffix)
      return 'debian11';
    return ('generic-linux' + archSuffix);
  }
  if (platform === 'win32')
    return 'win64';
  return '<unknown>';
})();

console.log('HOST platform: ' + hostPlatform);
