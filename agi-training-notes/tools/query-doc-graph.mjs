import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || path.join(import.meta.dirname, '..'));
const query = process.argv.slice(3).join(' ').toLowerCase().trim();
if (!query) throw new Error('usage: node tools/query-doc-graph.mjs <notes-dir> <topic words>');
const graph = JSON.parse(fs.readFileSync(path.join(root, 'DOC_GRAPH.json'), 'utf8'));
const terms = query.split(/\s+/);
const topics = graph.nodes.filter(n => n.type === 'topic' && terms.some(t => n.name.includes(t)));
const topicIds = new Set(topics.map(n => n.id));
const refs = graph.edges.filter(e => topicIds.has(e.to)).map(e => e.from);
const selected = graph.nodes.filter(n => refs.includes(n.id));
console.log(JSON.stringify({ query, topics, references: selected }, null, 2));
