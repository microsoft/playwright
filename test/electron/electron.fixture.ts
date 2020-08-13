import '../base.fixture';
import {ElectronApplication, ElectronLauncher, ElectronPage} from '../../electron-types';
import path from 'path';

const electronName = process.platform === 'win32' ? 'electron.cmd' : 'electron';

declare global {
  interface FixtureState {
    application: ElectronApplication;
    window: ElectronPage;
  }
}

declare module '../../index' {
  const electron: ElectronLauncher
}

registerFixture('application', async ({playwright}, test) => {
  const electronPath = path.join(__dirname, '..', '..', 'node_modules', '.bin', electronName);
  const application = await playwright.electron.launch(electronPath, {
    args: [path.join(__dirname, 'testApp.js')],
  });
  await test(application);
  await application.close();
});

registerFixture('window', async ({application}, test) => {
  const page = await application.newBrowserWindow({ width: 800, height: 600 });
  await test(page);
  await page.close();
});
