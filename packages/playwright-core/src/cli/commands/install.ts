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
    console.log(`Failed to list installed browsers\n${e}`);
    gracefullyProcessExitDoNotHang(1);
  }
}

export { listInstalledBrowsers };
