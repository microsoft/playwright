const os = require('os');

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
