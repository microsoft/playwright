import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, resolveConfig, DEFAULT_CONFIG } from '../src/index.mjs';
import { makeTempDir } from './helpers.mjs';

test('loadConfig returns defaults when no config file exists', async () => {
  const root = makeTempDir();
  try {
    const { config, file } = await loadConfig(root);
    assert.equal(file, null);
    assert.deepEqual(config, DEFAULT_CONFIG);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('loadConfig reads a JSON config file', async () => {
  const root = makeTempDir();
  try {
    fs.writeFileSync(path.join(root, 'doc-graph.config.json'), JSON.stringify({
      project: 'custom',
      documents: ['docs/**/*.md'],
      output: 'out/graph.json',
    }));
    const { config, file } = await loadConfig(root);
    assert.ok(file.endsWith('doc-graph.config.json'));
    assert.equal(config.project, 'custom');
    assert.deepEqual(config.documents, ['docs/**/*.md']);
    assert.equal(config.output, 'out/graph.json');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('loadConfig reads a .mjs config file with a default export', async () => {
  const root = makeTempDir();
  try {
    fs.writeFileSync(path.join(root, 'doc-graph.config.mjs'), 'export default { project: "mjs-project", documents: ["a.md"] };\n');
    const { config } = await loadConfig(root);
    assert.equal(config.project, 'mjs-project');
    assert.deepEqual(config.documents, ['a.md']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('resolveConfig applies defaults, file config, and overrides in order', () => {
  const root = '/tmp/example';
  const resolved = resolveConfig(root, { project: 'from-file', documents: ['x.md'] }, { output: 'override.json' });
  assert.equal(resolved.project, 'from-file');
  assert.deepEqual(resolved.documents, ['x.md']);
  assert.equal(resolved.output, 'override.json');
  assert.deepEqual(resolved.examples, DEFAULT_CONFIG.examples);
});

test('resolveConfig defaults project name to the directory basename', () => {
  const resolved = resolveConfig('/tmp/my-project', {}, {});
  assert.equal(resolved.project, 'my-project');
});
