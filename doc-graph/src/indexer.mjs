import fs from 'node:fs';
import path from 'node:path';
import { SCHEMA_VERSION } from './schema.mjs';
import { DocGraphError } from './errors.mjs';
import { glob, hasMagic } from './glob.mjs';
import { extractProvenance, readDocument } from './provenance.mjs';

function words(text) {
  return new Set((text.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) || []));
}

function exampleTitle(file) {
  const name = path.posix.basename(file).replace(/\.[^.]+$/, '');
  return name.replace(/^\d+-/, '').replace(/[-_]/g, ' ');
}

export function expandGlobs(patterns, root, { allowEmpty = false } = {}) {
  const list = Array.isArray(patterns) ? patterns : [patterns];
  const files = new Set();
  const missing = [];
  for (const pattern of list) {
    if (!pattern)
      continue;
    if (hasMagic(pattern)) {
      const matches = glob(pattern, root);
      if (matches.length === 0 && !allowEmpty)
        missing.push(pattern);
      for (const match of matches)
        files.add(match);
    } else {
      const full = path.isAbsolute(pattern) ? pattern : path.join(root, pattern);
      if (!fs.existsSync(full)) {
        if (!allowEmpty)
          missing.push(pattern);
        continue;
      }
      const rel = path.relative(root, full).split(path.sep).join('/');
      files.add(rel.startsWith('..') ? full : rel);
    }
  }
  return { files: [...files].sort(), missing };
}

export function buildGraph(root, config) {
  const documentsResult = expandGlobs(config.documents, root);
  if (documentsResult.missing.length)
    throw new DocGraphError(`No documents matched: ${documentsResult.missing.join(', ')}`, { missing: documentsResult.missing });

  const examplesResult = expandGlobs(config.examples, root, { allowEmpty: true });

  const nodes = [];
  const edges = [];
  const nodeIds = new Set();
  const edgeIds = new Set();
  const sourceDocuments = [];

  const addNode = (id, type, data = {}) => {
    if (nodeIds.has(id))
      return;
    nodeIds.add(id);
    nodes.push({ id, type, ...data });
  };
  const addEdge = (from, relation, to) => {
    const id = `${from}|${relation}|${to}`;
    if (edgeIds.has(id))
      return;
    edgeIds.add(id);
    edges.push({ from, relation, to });
  };

  for (const file of documentsResult.files) {
    const { content } = readDocument(file, root);
    const provenance = extractProvenance(content, config);
    sourceDocuments.push({ file, ...provenance });
    const docId = `doc:${file}`;
    addNode(docId, 'document', { file, ...provenance });
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      const match = line.match(/^(#{1,4})\s+(.+?)\s*$/);
      if (!match)
        return;
      const sectionId = `doc:${file}#${index + 1}`;
      addNode(sectionId, 'section', { title: match[2], file, line: index + 1, ...provenance });
      addEdge(docId, 'contains', sectionId);
      for (const word of words(match[2])) {
        const topicId = `topic:${word}`;
        addNode(topicId, 'topic', { name: word });
        addEdge(sectionId, 'about', topicId);
      }
    });
  }

  for (const file of examplesResult.files) {
    const exampleId = `example:${file}`;
    addNode(exampleId, 'example', { file, title: exampleTitle(file) });
    for (const word of words(exampleTitle(file))) {
      const topicId = `topic:${word}`;
      addNode(topicId, 'topic', { name: word });
      addEdge(exampleId, 'illustrates', topicId);
    }
  }

  const pinnedCommits = [...new Set(sourceDocuments.map(doc => doc.commit).filter(Boolean))];
  const pinnedCommitDates = [...new Set(sourceDocuments.map(doc => doc.commit_date).filter(Boolean))];

  const graph = {
    schema: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    project: config.project,
    pinned_commit: pinnedCommits.length === 1 ? pinnedCommits[0] : null,
    pinned_commit_date: pinnedCommitDates.length === 1 ? pinnedCommitDates[0] : null,
    source: [config.documents, config.examples].flat().join(', '),
    source_documents: sourceDocuments,
    source_examples: examplesResult.files,
    nodes,
    edges,
  };

  const outputPath = path.isAbsolute(config.output) ? config.output : path.join(root, config.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(graph, null, 2)}\n`);

  return {
    graph,
    output: outputPath,
    stats: {
      documents: documentsResult.files.length,
      examples: examplesResult.files.length,
      nodes: nodes.length,
      edges: edges.length,
      topics: nodes.filter(n => n.type === 'topic').length,
      sections: nodes.filter(n => n.type === 'section').length,
    },
  };
}

export function loadGraph(root, output) {
  const outputPath = path.isAbsolute(output) ? output : path.join(root, output);
  if (!fs.existsSync(outputPath))
    throw new DocGraphError(`Graph not found: ${outputPath}. Run \`doc-graph build\` first.`);
  return JSON.parse(fs.readFileSync(outputPath, 'utf8'));
}
