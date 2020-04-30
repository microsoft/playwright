const {firefox} = require('../..');
const os = require('os');
const path = require('path');

const executablePath = {
  'darwin': path.join(__dirname, 'pw_run.sh'),
  'linux': path.join(__dirname, 'pw_run.sh'),
  'win32': undefined,
}[os.platform()];

// TODO: verify build on windows.
if (!executablePath)
  return;

async function checkSanity(options) {
  const browser = await firefox.launch({...options, executablePath});
  const context = await browser.newContext();
  const page = await context.newPage();
  const result = await page.evaluate(() => 7 * 8);
  await browser.close();
  if (result !== 56)
    throw new Error(`ERROR: computation failed!`);
  console.log(`SUCCESS: ran webkit with options = ${JSON.stringify(options)}`);
}

Promise.all([
  checkSanity({headless: true}),
  checkSanity({headless: false}),
]).catch(e => {
  console.error(e);
  process.exitCode = 1;
});

