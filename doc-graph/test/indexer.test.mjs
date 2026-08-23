import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { buildGraph, loadGraph, SCHEMA_VERSION, DocGraphError } from '../src/index.mjs';
import { writeProject, cleanup } from './helpers.mjs';

test('builds a graph with documents, sections, topics, and examples', () => {
  const root = writeProject();
  try {
    const { graph, stats } = buildGraph(root, {
      project: 'playwright',
      documents: ['NOTES.md', 'API_REFERENCE.md'],
      examples: ['examples/*.js'],
      output: 'DOC_GRAPH.json',
    });

    assert.equal(graph.schema, SCHEMA_VERSION);
    assert.equal(graph.project, 'playwright');
    assert.ok(graph.generated_at);
    assert.equal(graph.pinned_commit, 'abc123abc123abc123abc123abc123abc123abc1');
    assert.equal(graph.pinned_commit_date, '2026-08-06');

    const documents = graph.nodes.filter(n => n.type === 'document');
    assert.equal(documents.length, 2);
    assert.ok(documents.every(d => d.commit === 'abc123abc123abc123abc123abc123abc123abc1'));

    const sections = graph.nodes.filter(n => n.type === 'section');
    assert.equal(sections.length, 12);
    const browserSection = sections.find(s => s.title === 'Browser Launch Mechanism');
    assert.equal(browserSection.file, 'NOTES.md');
    assert.equal(browserSection.line, 7);

    const topics = graph.nodes.filter(n => n.type === 'topic');
    assert.ok(topics.length > 0);
    assert.ok(topics.some(t => t.name === 'browser'));

    const examples = graph.nodes.filter(n => n.type === 'example');
    assert.equal(examples.length, 3);
    assert.equal(stats.examples, 3);

    const contains = graph.edges.filter(e => e.relation === 'contains');
    assert.equal(contains.length, sections.length);
    const about = graph.edges.filter(e => e.relation === 'about');
    assert.ok(about.length > 0);
    const illustrates = graph.edges.filter(e => e.relation === 'illustrates');
    assert.ok(illustrates.length > 0);

    assert.ok(fs.existsSync(path.join(root, 'DOC_GRAPH.json')));
  } finally {
    cleanup(root);
  }
});

test('records source line references and provenance per section', () => {
  const root = writeProject();
  try {
    const { graph } = buildGraph(root, {
      project: 'playwright',
      documents: ['NOTES.md'],
      examples: [],
      output: 'DOC_GRAPH.json',
    });
    const section = graph.nodes.find(n => n.type === 'section' && n.title === 'Locator Architecture');
    assert.equal(section.line, 11);
    assert.equal(section.commit, 'abc123abc123abc123abc123abc123abc123abc1');
  } finally {
    cleanup(root);
  }
});

test('throws a DocGraphError for missing document files', () => {
  const root = writeProject();
  try {
    assert.throws(() => buildGraph(root, {
      project: 'playwright',
      documents: ['NOTES.md', 'MISSING.md'],
      examples: [],
      output: 'DOC_GRAPH.json',
    }), DocGraphError);
  } finally {
    cleanup(root);
  }
});

test('tolerates missing examples glob', () => {
  const root = writeProject();
  try {
    const { graph } = buildGraph(root, {
      project: 'playwright',
      documents: ['NOTES.md'],
      examples: ['examples/*.py'],
      output: 'DOC_GRAPH.json',
    });
    assert.equal(graph.source_examples.length, 0);
  } finally {
    cleanup(root);
  }
});

test('writes to a configurable output path and preserves schema', () => {
  const root = writeProject();
  try {
    buildGraph(root, {
      project: 'playwright',
      documents: ['NOTES.md'],
      examples: [],
      output: 'artifacts/graph.json',
    });
    assert.ok(fs.existsSync(path.join(root, 'artifacts', 'graph.json')));
    const loaded = loadGraph(root, 'artifacts/graph.json');
    assert.equal(loaded.schema, SCHEMA_VERSION);
  } finally {
    cleanup(root);
  }
});

test('loadGraph throws when the graph is missing', () => {
  const root = writeProject();
  try {
    assert.throws(() => loadGraph(root, 'DOC_GRAPH.json'), DocGraphError);
  } finally {
    cleanup(root);
  }
});
