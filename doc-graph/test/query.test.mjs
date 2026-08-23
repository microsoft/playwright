import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildGraph, loadGraph, search, retrieveContext } from '../src/index.mjs';
import { writeProject, cleanup } from './helpers.mjs';

function buildFixture() {
  const root = writeProject();
  const { graph } = buildGraph(root, {
    project: 'playwright',
    documents: ['NOTES.md', 'API_REFERENCE.md'],
    examples: ['examples/*.js'],
    output: 'DOC_GRAPH.json',
  });
  return { root, graph };
}

test('search returns ranked, bounded references with file paths and line numbers', () => {
  const { root, graph } = buildFixture();
  try {
    const result = search(graph, 'browser launch');
    assert.ok(result.total > 0);
    assert.equal(result.references.length, result.total <= 20 ? result.total : 20);
    const first = result.references[0];
    assert.ok(first.file);
    assert.ok(first.line !== null || first.type === 'example');
    assert.ok(Array.isArray(first.matched));
    assert.ok(first.score > 0);
  } finally {
    cleanup(root);
  }
});

test('search matches example nodes for a topic', () => {
  const { root, graph } = buildFixture();
  try {
    const result = search(graph, 'tracing');
    assert.ok(result.references.some(r => r.type === 'example' && r.file === 'examples/03-tracing-pipeline.js'));
  } finally {
    cleanup(root);
  }
});

test('search respects the limit option', () => {
  const { root, graph } = buildFixture();
  try {
    const result = search(graph, 'locator', { limit: 3 });
    assert.ok(result.references.length <= 3);
    assert.ok(result.total >= result.references.length);
  } finally {
    cleanup(root);
  }
});

test('search ranks exact topic matches above partial matches', () => {
  const { root, graph } = buildFixture();
  try {
    const result = search(graph, 'locator');
    assert.ok(result.references.length > 0);
    const scores = result.references.map(r => r.score);
    for (let i = 1; i < scores.length; i++)
      assert.ok(scores[i - 1] >= scores[i], 'references should be sorted by descending score');
  } finally {
    cleanup(root);
  }
});

test('context returns source excerpts suitable for prompting a model', () => {
  const { root, graph } = buildFixture();
  try {
    const result = retrieveContext(graph, 'browser launch', { limit: 5, root });
    assert.ok(result.references.length > 0);
    const section = result.references.find(r => r.type === 'section');
    assert.ok(section, 'expected at least one section reference');
    assert.ok(section.file);
    assert.ok(section.line !== null);
    assert.ok(typeof section.excerpt === 'string');
    assert.ok(section.excerpt.length > 0);
    assert.ok(section.excerpt.includes('Browser Launch Mechanism'));
  } finally {
    cleanup(root);
  }
});

test('context marks stale references whose source file is missing', () => {
  const { root, graph } = buildFixture();
  try {
    fs.rmSync(path.join(root, 'NOTES.md'));
    const result = retrieveContext(graph, 'browser launch', { limit: 20, root });
    const stale = result.references.find(r => r.file === 'NOTES.md');
    assert.ok(stale);
    assert.equal(stale.excerpt, null);
    assert.equal(stale.missing, true);
  } finally {
    cleanup(root);
  }
});

test('search for an unknown query returns no references', () => {
  const { root, graph } = buildFixture();
  try {
    const result = search(graph, 'zzzzznonexistent');
    assert.equal(result.total, 0);
    assert.equal(result.references.length, 0);
  } finally {
    cleanup(root);
  }
});
