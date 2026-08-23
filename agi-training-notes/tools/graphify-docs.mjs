import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || path.join(import.meta.dirname, '..'));
const out = path.resolve(process.argv[3] || path.join(root, 'DOC_GRAPH.json'));
const nodes = [];
const edges = [];
const nodeIds = new Set();
const edgeIds = new Set();
const sourceDocuments = [];

function addNode(id, type, data = {}) {
  if (nodeIds.has(id)) return;
  nodeIds.add(id);
  nodes.push({ id, type, ...data });
}
function addEdge(from, relation, to) {
  const id = `${from}|${relation}|${to}`;
  if (edgeIds.has(id)) return;
  edgeIds.add(id);
  edges.push({ from, relation, to });
}
function words(text) {
  return new Set(text.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) || []);
}
function parseProvenance(content) {
  const commit = content.match(/Source Commit:\s*`([a-f0-9]+)`/)?.[1];
  const commitDate = content.match(/Commit Date:\s*`([^`]+)`/)?.[1];
  return { commit, commitDate };
}

for (const file of ['NOTES.md', 'API_REFERENCE.md']) {
  const full = path.join(root, file);
  const content = fs.readFileSync(full, 'utf8');
  const { commit, commitDate } = parseProvenance(content);
  sourceDocuments.push({ file, commit, commit_date: commitDate });
  const doc = `doc:${file}`;
  addNode(doc, 'document', { file, commit, commit_date: commitDate });
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    const match = line.match(/^(#{1,4})\s+(.+?)\s*$/);
    if (!match) return;
    const section = `doc:${file}#${index + 1}`;
    addNode(section, 'section', { title: match[2], file, line: index + 1, commit, commit_date: commitDate });
    addEdge(doc, 'contains', section);
    for (const word of words(match[2])) {
      const topic = `topic:${word}`;
      addNode(topic, 'topic', { name: word });
      addEdge(section, 'about', topic);
    }
  });
}

const examples = path.join(root, 'examples');
sourceDocuments.push({ file: 'examples/*.js' });
for (const file of fs.readdirSync(examples).filter(name => name.endsWith('.js')).sort()) {
  const title = file.replace(/\.js$/, '').replace(/^\d+-/, '').replace(/-/g, ' ');
  const example = `example:${file}`;
  addNode(example, 'example', { file: `examples/${file}`, title });
  for (const word of words(title)) {
    const topic = `topic:${word}`;
    addNode(topic, 'topic', { name: word });
    addEdge(example, 'illustrates', topic);
  }
}

const pinnedCommits = [...new Set(sourceDocuments.map(doc => doc.commit).filter(Boolean))];
const pinnedCommitDates = [...new Set(sourceDocuments.map(doc => doc.commit_date).filter(Boolean))];

const graph = {
  schema: 2,
  generated_at: new Date().toISOString(),
  pinned_commit: pinnedCommits.length === 1 ? pinnedCommits[0] : null,
  pinned_commit_date: pinnedCommitDates.length === 1 ? pinnedCommitDates[0] : null,
  source: 'NOTES.md, API_REFERENCE.md, examples/*.js',
  source_documents: sourceDocuments,
  nodes,
  edges,
};
fs.writeFileSync(out, `${JSON.stringify(graph, null, 2)}\n`);
console.log(JSON.stringify({ out, nodes: nodes.length, edges: edges.length }));
