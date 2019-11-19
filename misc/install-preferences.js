const os = require('os');
const fs = require('fs');
const path = require('path');
const util = require('util');

// Install browser preferences after downloading and unpacking
// firefox instances.
// Based on:   https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Enterprise_deployment_before_60#Configuration
async function installFirefoxPreferences(executablePath) {
  const firefoxFolder = path.dirname(executablePath);
  const mkdirAsync = util.promisify(fs.mkdir.bind(fs));

  let prefPath = '';
  let configPath = '';
  if (os.platform() === 'darwin') {
    prefPath = path.join(firefoxFolder, '..', 'Resources', 'defaults', 'pref');
    configPath = path.join(firefoxFolder, '..', 'Resources');
  } else if (os.platform() === 'linux') {
    if (!fs.existsSync(path.join(firefoxFolder, 'browser', 'defaults')))
      await mkdirAsync(path.join(firefoxFolder, 'browser', 'defaults'));
    if (!fs.existsSync(path.join(firefoxFolder, 'browser', 'defaults', 'preferences')))
      await mkdirAsync(path.join(firefoxFolder, 'browser', 'defaults', 'preferences'));
    prefPath = path.join(firefoxFolder, 'browser', 'defaults', 'preferences');
    configPath = firefoxFolder;
  } else if (os.platform() === 'win32') {
    prefPath = path.join(firefoxFolder, 'defaults', 'pref');
    configPath = firefoxFolder;
  } else {
    throw new Error('Unsupported platform: ' + os.platform());
  }

  await Promise.all([
    copyFile({
      from: path.join(__dirname, '00-playwright-prefs.js'),
      to: path.join(prefPath, '00-playwright-prefs.js'),
    }),
    copyFile({
      from: path.join(__dirname, 'playwright.cfg'),
      to: path.join(configPath, 'playwright.cfg'),
    }),
  ]);
}

function copyFile({from, to}) {
  var rd = fs.createReadStream(from);
  var wr = fs.createWriteStream(to);
  return new Promise(function(resolve, reject) {
    rd.on('error', reject);
    wr.on('error', reject);
    wr.on('finish', resolve);
    rd.pipe(wr);
  }).catch(function(error) {
    rd.destroy();
    wr.end();
    throw error;
  });
}

module.exports = installFirefoxPreferences;
