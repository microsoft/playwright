import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { writeProject, cleanup } from './helpers.mjs';

const BIN = path.resolve(import.meta.dirname, '..', 'bin', 'doc-graph.mjs');

function run(args, cwd) {
  return spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8' });
}

test('cli --help prints usage', () => {
  const result = run(['--help'], process.cwd());
  assert.equal(result.status, 0);
  assert.match(result.stdout, /doc-graph/);
  assert.match(result.stdout, /build/);
  assert.match(result.stdout, /search/);
  assert.match(result.stdout, /context/);
});

test('cli build writes the graph and reports stats', () => {
  const root = writeProject();
  try {
    const result = run(['build'], root);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(fs.existsSync(path.join(root, 'DOC_GRAPH.json')));
    const report = JSON.parse(result.stdout);
    assert.equal(report.stats.documents, 2);
    assert.equal(report.stats.examples, 3);
  } finally {
    cleanup(root);
  }
});

test('cli search and context answer queries', () => {
  const root = writeProject();
  try {
    assert.equal(run(['build'], root).status, 0);
    const search = run(['search', 'browser', 'launch'], root);
    assert.equal(search.status, 0, search.stderr);
    const searchBody = JSON.parse(search.stdout);
    assert.ok(searchBody.references.length > 0);

    const context = run(['context', 'locator'], root);
    assert.equal(context.status, 0, context.stderr);
    const contextBody = JSON.parse(context.stdout);
    assert.ok(contextBody.references.length > 0);
    assert.ok(contextBody.references[0].excerpt.length > 0);
  } finally {
    cleanup(root);
  }
});

test('cli search without a query fails cleanly', () => {
  const root = writeProject();
  try {
    assert.equal(run(['build'], root).status, 0);
    const result = run(['search'], root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /requires a query/);
  } finally {
    cleanup(root);
  }
});
