import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph } from '../src/index.mjs';
import { createMcpHandler, MCP_TOOLS } from '../src/mcp.mjs';
import { writeProject, cleanup } from './helpers.mjs';

function fixture() {
  const root = writeProject();
  buildGraph(root, {
    project: 'fixture',
    documents: ['NOTES.md', 'API_REFERENCE.md'],
    examples: ['examples/*.js'],
    output: 'DOC_GRAPH.json',
  });
  return root;
}

test('MCP initializes and lists read-only documentation tools', async () => {
  const root = fixture();
  try {
    const handle = createMcpHandler({ root, config: { output: 'DOC_GRAPH.json' } });
    const initialized = await handle({ jsonrpc: '2.0', id: 1, method: 'initialize' });
    assert.equal(initialized.result.serverInfo.name, 'doc-graph');
    const listed = await handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    assert.deepEqual(listed.result.tools.map(tool => tool.name), MCP_TOOLS.map(tool => tool.name));
  } finally {
    cleanup(root);
  }
});

test('MCP tool calls return structured search and context results', async () => {
  const root = fixture();
  try {
    const handle = createMcpHandler({ root, config: { output: 'DOC_GRAPH.json', excerptLines: 20, maxExcerptLines: 50 } });
    const search = await handle({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'doc_graph_search', arguments: { query: 'browser launch', limit: 3 } } });
    assert.ok(search.result.structuredContent.references.length > 0);
    assert.equal(search.result.content[0].type, 'text');
    const context = await handle({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'doc_graph_context', arguments: { query: 'browser launch' } } });
    assert.ok(context.result.structuredContent.references.some(ref => ref.excerpt));
  } finally {
    cleanup(root);
  }
});

test('MCP rejects unknown tools and invalid arguments', async () => {
  const root = fixture();
  try {
    const handle = createMcpHandler({ root, config: { output: 'DOC_GRAPH.json' } });
    const unknown = await handle({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'delete_docs' } });
    assert.equal(unknown.error.code, -32602);
    const invalid = await handle({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'doc_graph_search', arguments: { query: '' } } });
    assert.equal(invalid.error.code, -32602);
  } finally {
    cleanup(root);
  }
});
