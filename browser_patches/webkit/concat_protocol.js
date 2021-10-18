const fs = require('fs');
const path = require('path');
const checkoutPath = process.env.WK_CHECKOUT_PATH || path.join(process.env.HOME, 'webkit');
const protocolDir = path.join(checkoutPath, './Source/JavaScriptCore/inspector/protocol');
const files = fs.readdirSync(protocolDir).filter(f => f.endsWith('.json')).map(f => path.join(protocolDir, f));
const json = files.map(file => JSON.parse(fs.readFileSync(file)));
console.log(JSON.stringify(json));
