const playwright = require('playwright-core');
const { execSync } = require('child_process');
const path = require('path');

(async () => {
  const dir = process.argv[2];
  const chrome = await playwright.chromium.launch({ channel: 'chrome' });
  const version = chrome.version();
  await chrome.close();
  console.log(`Found Chrome version ${version}`);

  const [major] = version.split('.');
  const driverVersion = execSync(`curl https://chromedriver.storage.googleapis.com/LATEST_RELEASE_${major} --silent`).toString('utf-8');
  console.log(`Found ChromeDriver version ${driverVersion}`);

  const zip = path.join(dir, 'chromedriver.zip');
  execSync(`curl https://chromedriver.storage.googleapis.com/${driverVersion}/chromedriver_${process.platform === 'darwin' ? 'mac' : 'linux'}64.zip --output ${zip} --silent`);
  console.log(`Downloaded ${zip}`);

  execSync(`unzip ${zip}`, { cwd: dir });
  console.log(`Unzipped ${zip}`);
})();
