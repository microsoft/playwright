//
// Fetches upstream WebKit Web Inspector protocol definitions from
// github.com/WebKit/WebKit (main branch) and generates an up-to-date
// `packages/playwright-core/src/server/webkit/webview/protocol.d.ts` so we
// can verify our webview code against the upstream API surface.
//
// Outputs (next to the .d.ts):
//   - protocol.json — merged source consumed by jsonToTS()
//   - protocol.d.ts — TypeScript types
//
// Usage: node utils/protocol-types-generator/update-webview-protocol.js

const fs = require('fs');
const path = require('path');
const { jsonToTS } = require('./index.js');

const REPO = 'WebKit/WebKit';
const REF = 'main';
const PROTOCOL_DIR = 'Source/JavaScriptCore/inspector/protocol';

const OUT_DIR = path.join(__dirname, '../../packages/playwright-core/src/server/webkit/webview');
const OUT_JSON = path.join(OUT_DIR, 'protocol.json');
const OUT_DTS = path.join(OUT_DIR, 'protocol.d.ts');

async function ghFetch(url) {
  const headers = { 'User-Agent': 'playwright-protocol-sync' };
  if (process.env.GITHUB_TOKEN)
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok)
    throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res;
}

async function listProtocolFiles() {
  const url = `https://api.github.com/repos/${REPO}/contents/${PROTOCOL_DIR}?ref=${REF}`;
  const res = await ghFetch(url);
  const items = await res.json();
  return items
      .filter(e => e.type === 'file' && e.name.endsWith('.json'))
      .map(e => ({ name: e.name, downloadUrl: e.download_url }));
}

async function fetchDomain(file) {
  const res = await ghFetch(file.downloadUrl);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`Failed to parse ${file.name}: ${e.message}`);
  }
}

(async () => {
  const files = await listProtocolFiles();
  console.log(`Found ${files.length} domain files in ${PROTOCOL_DIR}@${REF}`);

  const domains = [];
  for (const file of files) {
    const domain = await fetchDomain(file);
    domains.push(domain);
    console.log(`  - ${file.name} -> ${domain.domain}`);
  }
  domains.sort((a, b) => a.domain.localeCompare(b.domain));

  await fs.promises.mkdir(OUT_DIR, { recursive: true });
  await fs.promises.writeFile(OUT_JSON, JSON.stringify(domains, null, 2) + '\n');
  console.log(`Wrote ${path.relative(process.cwd(), OUT_JSON)}`);

  const dts = jsonToTS({ domains });
  await fs.promises.writeFile(OUT_DTS, dts);
  console.log(`Wrote ${path.relative(process.cwd(), OUT_DTS)}`);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
