import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { loadConfig, resolveConfig, buildGraph, loadGraph, search, retrieveContext, SCHEMA_VERSION } from '../src/index.mjs';

const FIXTURE = path.resolve(import.meta.dirname, 'fixtures', 'second-project');

test('second project with a different layout indexes without code changes', async () => {
  const { config } = await loadConfig(FIXTURE);
  const resolved = resolveConfig(FIXTURE, config, {});

  assert.equal(resolved.project, 'acme-docs');
  assert.deepEqual(resolved.documents, ['docs/**/*.md']);
  assert.deepEqual(resolved.examples, ['snippets/**/*.py']);

  const { graph, stats } = buildGraph(FIXTURE, resolved);

  assert.equal(graph.schema, SCHEMA_VERSION);
  assert.equal(graph.project, 'acme-docs');

  const documents = graph.nodes.filter(n => n.type === 'document');
  assert.equal(documents.length, 2);
  assert.ok(documents.some(d => d.file === 'docs/index.md'));
  assert.ok(documents.some(d => d.file === 'docs/guides/getting-started.md'));

  const examples = graph.nodes.filter(n => n.type === 'example');
  assert.equal(examples.length, 2);
  assert.ok(examples.some(e => e.file === 'snippets/hello.py'));
  assert.ok(examples.some(e => e.file === 'snippets/retry-backoff.py'));

  assert.equal(stats.documents, 2);
  assert.equal(stats.examples, 2);

  const output = path.join(FIXTURE, 'graph.json');
  assert.ok(fs.existsSync(output));
  fs.rmSync(output, { force: true });
});

test('second project provenance is captured', async () => {
  const { config } = await loadConfig(FIXTURE);
  const resolved = resolveConfig(FIXTURE, config, {});
  const { graph } = buildGraph(FIXTURE, resolved);
  try {
    const indexDoc = graph.nodes.find(n => n.type === 'document' && n.file === 'docs/index.md');
    assert.equal(indexDoc.commit, 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef');
    assert.equal(indexDoc.commit_date, '2026-08-20');
  } finally {
    fs.rmSync(path.join(FIXTURE, 'graph.json'), { force: true });
  }
});

test('second project search and context work', async () => {
  const { config } = await loadConfig(FIXTURE);
  const resolved = resolveConfig(FIXTURE, config, {});
  buildGraph(FIXTURE, resolved);
  try {
    const graph = loadGraph(FIXTURE, 'graph.json');

    const result = search(graph, 'webhook');
    assert.ok(result.references.some(r => r.file === 'docs/guides/getting-started.md'));

    const exampleResult = search(graph, 'retry backoff');
    assert.ok(exampleResult.references.some(r => r.type === 'example' && r.file === 'snippets/retry-backoff.py'));

    const context = retrieveContext(graph, 'configuration', { limit: 10, root: FIXTURE });
    assert.ok(context.references.length > 0);
    assert.ok(context.references[0].excerpt.length > 0);
  } finally {
    fs.rmSync(path.join(FIXTURE, 'graph.json'), { force: true });
  }
});
