const { execSync } = require('child_process');
const { mkdirSync } = require('fs');
const path = require('path');

async function downloadFile(url, dir, filename) {
  const output = path.join(dir, filename);
  execSync(`curl -L --silent --output ${output} ${url}`);
}

(async () => {
  const dir = process.argv[2];
  mkdirSync(dir);
  downloadFile('https://github.com/SeleniumHQ/selenium/releases/download/selenium-4.8.0/selenium-server-4.8.3.jar', dir, 'selenium-server-4.8.3.jar')
  downloadFile('https://github.com/SeleniumHQ/selenium/releases/download/selenium-3.141.59/selenium-server-standalone-3.141.59.jar', dir, 'selenium-server-standalone-3.141.59.jar')
})();
