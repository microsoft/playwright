// This script is supposed to be run with a path to either of the following configs from chromium checkout:
// - infra/archive_config/mac-archive-rel.json
// - infra/archive_config/linux-archive-rel.json
// - infra/archive_config/win-archive-rel.json

const fs = require('fs');

const configs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).archive_datas;
const config = configs.find(config => config.gcs_path.includes('chrome-linux.zip') || config.gcs_path.includes('chrome-win.zip') || config.gcs_path.includes('chrome-mac.zip'));
for (const file of config.files || [])
  console.log(file);
for (const dir of config.dirs || [])
  console.log(dir);
