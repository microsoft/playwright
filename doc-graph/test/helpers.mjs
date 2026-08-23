import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function makeTempDir(prefix = 'doc-graph-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function writeProject() {
  const root = makeTempDir();
  fs.writeFileSync(path.join(root, 'NOTES.md'), `# Architecture Notes

> **Provenance**
> - Source Commit: \`abc123abc123abc123abc123abc123abc123abc1\`
> - Commit Date: \`2026-08-06\`

## Browser Launch Mechanism

## Context and Page Ownership

## Locator Architecture

## Tracing and Frames
`);
  fs.writeFileSync(path.join(root, 'API_REFERENCE.md'), `# API Reference

> **Provenance**
> - Source Commit: \`abc123abc123abc123abc123abc123abc123abc1\`
> - Commit Date: \`2026-08-06\`

## Page

### Page.goto

### Page.goBack

## Locator

### Locator.click

### Locator.fill
`);
  fs.mkdirSync(path.join(root, 'examples'));
  fs.writeFileSync(path.join(root, 'examples', '01-launch-browser.js'), `// launch a browser\n`);
  fs.writeFileSync(path.join(root, 'examples', '02-locator-basics.js'), `// locator basics\n`);
  fs.writeFileSync(path.join(root, 'examples', '03-tracing-pipeline.js'), `// tracing pipeline\n`);
  return root;
}

export function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}
