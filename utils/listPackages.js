const fs = require('fs');
const path = require('path');
const packageDir = path.join(__dirname, '..', 'packages');
const packages = fs.readdirSync(packageDir).map(name => {
  return path.join(packageDir, name);
});
module.exports = {packages};