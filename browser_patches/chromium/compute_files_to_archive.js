// This script is supposed to be run with a path to either of the following configs from chromium checkout:
// - infra/archive_config/mac-archive-rel.json
// - infra/archive_config/linux-archive-rel.json
// - infra/archive_config/win-archive-rel.json

const fs = require('fs');

const configs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).archive_datas;
const config = configs.find(config => config.gcs_path.includes('chrome-linux.zip') || config.gcs_path.includes('chrome-win.zip') || config.gcs_path.includes('chrome-mac.zip'));

const excludeList = new Set([
  // We do not need interactive tests in our archive.
  'interactive_ui_tests.exe',
]);

// There is no upstream configuration for packaging Linux Arm64 builds,
// so we build one by replacing x86_64-specific nacl binary with arm one.
const replaceMap = {
  '--linux-arm64': {
    'nacl_irt_x86_64.nexe': 'nacl_irt_arm.nexe',
  },
}[process.argv[3]] || {};

const entries = [
  ...(config.files || []),
  ...(config.dirs || []),
].filter(entry => !excludeList.has(entry)).map(entry => replaceMap[entry] || entry);

for (const entry of entries)
  console.log(entry);
