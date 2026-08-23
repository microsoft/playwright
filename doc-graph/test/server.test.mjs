import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph, createServer } from '../src/index.mjs';
import { writeProject, cleanup } from './helpers.mjs';

async function startServer(config) {
  const server = createServer(config);
  await new Promise(resolve => server.listen(0, resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  return { server, base };
}

function fixture() {
  const root = writeProject();
  const { graph } = buildGraph(root, {
    project: 'playwright',
    documents: ['NOTES.md', 'API_REFERENCE.md'],
    examples: ['examples/*.js'],
    output: 'DOC_GRAPH.json',
  });
  return { root, graph };
}

test('GET /health returns ok', async () => {
  const { root } = fixture();
  const { server, base } = await startServer({ root, config: { project: 'playwright', output: 'DOC_GRAPH.json' } });
  try {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.project, 'playwright');
  } finally {
    await new Promise(resolve => server.close(resolve));
    cleanup(root);
  }
});

test('GET /search returns ranked references with provenance', async () => {
  const { root } = fixture();
  const { server, base } = await startServer({ root, config: { project: 'playwright', output: 'DOC_GRAPH.json', excerptLines: 80, maxExcerptLines: 200 } });
  try {
    const res = await fetch(`${base}/search?q=browser+launch&limit=5`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/json/);
    const body = await res.json();
    assert.ok(body.references.length > 0);
    assert.ok(body.references.length <= 5);
    assert.ok(body.references[0].file);
  } finally {
    await new Promise(resolve => server.close(resolve));
    cleanup(root);
  }
});

test('GET /context returns source excerpts', async () => {
  const { root } = fixture();
  const { server, base } = await startServer({ root, config: { project: 'playwright', output: 'DOC_GRAPH.json', excerptLines: 80, maxExcerptLines: 200 } });
  try {
    const res = await fetch(`${base}/context?q=locator`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.references.length > 0);
    assert.ok(body.references[0].excerpt.length > 0);
  } finally {
    await new Promise(resolve => server.close(resolve));
    cleanup(root);
  }
});

test('GET /search without q returns 400', async () => {
  const { root } = fixture();
  const { server, base } = await startServer({ root, config: { project: 'playwright', output: 'DOC_GRAPH.json' } });
  try {
    const res = await fetch(`${base}/search`);
    assert.equal(res.status, 400);
  } finally {
    await new Promise(resolve => server.close(resolve));
    cleanup(root);
  }
});

test('unknown route returns 404', async () => {
  const { root } = fixture();
  const { server, base } = await startServer({ root, config: { project: 'playwright', output: 'DOC_GRAPH.json' } });
  try {
    const res = await fetch(`${base}/nope`);
    assert.equal(res.status, 404);
  } finally {
    await new Promise(resolve => server.close(resolve));
    cleanup(root);
  }
});
