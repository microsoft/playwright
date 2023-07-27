const playwright = require('playwright-core');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

(async () => {
  const dir = process.argv[2];
  const chrome = await playwright.chromium.launch({ channel: 'chrome' });
  const version = chrome.version();
  await chrome.close();
  console.log(`Found Chrome version ${version}`);

  const [major] = version.split('.');
  const downloadsInfo = JSON.parse(execSync(`curl https://googlechromelabs.github.io/chrome-for-testing/latest-versions-per-milestone-with-downloads.json --silent`).toString('utf-8'));

  let currentPlatform = '';
  if (process.platform === 'darwin')
    currentPlatform = process.arch === 'arm64' ? 'mac-arm64' : 'mac-x64';
  else if (process.platform === 'linux')
    currentPlatform = 'linux64';
  else 
    currentPlatform = 'win64';
  const chromeDriverURL = downloadsInfo.milestones[major].downloads.chromedriver.find(({ platform, url }) => platform === currentPlatform).url;
  console.log(`Found ChromeDriver download URL: ${chromeDriverURL}`);

  const zip = path.join(dir, 'chromedriver.zip');
  execSync(`curl ${chromeDriverURL} --output ${zip} --silent`);
  console.log(`Downloaded ${zip}`);

  execSync(`unzip -j ${zip}`, { cwd: dir });
  console.log(`Unzipped ${zip}`);
  fs.rmSync(zip);
})();
