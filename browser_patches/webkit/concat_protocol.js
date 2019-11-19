const fs = require('fs');
const path = require('path');
const protocolDir = path.join(__dirname, './checkout/Source/JavaScriptCore/inspector/protocol');
const files = fs.readdirSync(protocolDir).filter(f => f.endsWith('.json')).map(f => path.join(protocolDir, f));
const json = files.map(file => JSON.parse(fs.readFileSync(file)));
console.log(JSON.stringify(json));
