const {firefox} = require('../..');
const os = require('os');
const path = require('path');

const executablePath = {
  'darwin': path.join(__dirname, 'checkout', 'obj-build-playwright', 'dist', 'Nightly.app', 'Contents', 'MacOS', 'firefox'),
  'linux': path.join(__dirname, 'checkout', 'obj-build-playwright', 'dist', 'bin', 'firefox'),
  'win32': path.join(__dirname, 'checkout', 'obj-build-playwright', 'dist', 'bin', 'firefox.exe'),
}[os.platform()];

async function checkSanity(options) {
  const browser = await firefox.launch({...options, executablePath});
  const context = await browser.newContext();
  const page = await context.newPage();
  const result = await page.evaluate(() => 6 * 7);
  await browser.close();
  if (result !== 42)
    throw new Error(`ERROR: computation failed!`);
  console.log(`SUCCESS: ran firefox with options = ${JSON.stringify(options)}`);
}

Promise.all([
  checkSanity({headless: true}),
  checkSanity({headless: false}),
]).catch(e => {
  console.error(e);
  process.exitCode = 1;
});
