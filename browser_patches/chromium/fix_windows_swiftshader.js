// See https://github.com/microsoft/playwright/issues/6390
const fs = require('fs');

const FILE_PATH = process.argv[2];
if (!fs.existsSync(FILE_PATH) || !FILE_PATH.endsWith('.json'))
  return;

const json = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));

if (json.ICD && json.ICD.library_path && json.ICD.library_path.startsWith('.\\')) {
  json.ICD.library_path = json.ICD.library_path.substring(2);
  fs.writeFileSync(FILE_PATH, JSON.stringify(json), 'utf8');
}
