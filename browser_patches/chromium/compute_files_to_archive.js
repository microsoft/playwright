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
  // We no longer compile nacl with Chromium.
  'nacl_helper_bootstrap',
  'nacl_helper',
  'nacl_irt_x86_64.nexe',
]);

const entries = [
  ...(config.files || []),
  ...(config.dirs || []),
].filter(entry => !excludeList.has(entry));

for (const entry of entries)
  console.log(entry);
