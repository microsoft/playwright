import readline from 'node:readline';
import { loadGraph } from './indexer.mjs';
import { search, retrieveContext } from './query.mjs';

const PROTOCOL_VERSION = '2025-06-18';

export const MCP_TOOLS = [
  {
    name: 'doc_graph_search',
    description: 'Search indexed project documentation and examples for relevant references.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Documentation question or keywords.' },
        limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Maximum references to return.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'doc_graph_context',
    description: 'Retrieve ranked documentation references with bounded source excerpts.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Documentation question or keywords.' },
        limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Maximum references to return.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
];

const rpcResponse = (id, result) => ({ jsonrpc: '2.0', id, result });
const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
const toolResult = value => ({
  content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
  structuredContent: value,
});

export function createMcpHandler({ root, config, graphPath }) {
  const output = graphPath ?? config.output;
  return async message => {
    if (!message || message.jsonrpc !== '2.0' || message.id === undefined)
      return null;
    if (message.method === 'initialize')
      return rpcResponse(message.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'doc-graph', version: '0.1.0' },
      });
    if (message.method === 'ping') return rpcResponse(message.id, {});
    if (message.method === 'tools/list') return rpcResponse(message.id, { tools: MCP_TOOLS });
    if (message.method !== 'tools/call') return rpcError(message.id, -32601, `Method not found: ${message.method}`);

    const name = message.params?.name;
    const args = message.params?.arguments ?? {};
    if (!MCP_TOOLS.some(tool => tool.name === name)) return rpcError(message.id, -32602, `Unknown tool: ${name}`);
    if (typeof args.query !== 'string' || !args.query.trim()) return rpcError(message.id, -32602, 'The "query" argument is required.');
    const limit = args.limit === undefined ? undefined : Number(args.limit);
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100))
      return rpcError(message.id, -32602, 'The "limit" argument must be an integer between 1 and 100.');

    try {
      const graph = loadGraph(root, output);
      const value = name === 'doc_graph_search'
        ? search(graph, args.query.trim(), limit ? { limit } : {})
        : retrieveContext(graph, args.query.trim(), {
          limit: limit ?? 10,
          excerptLines: config.excerptLines,
          maxExcerptLines: config.maxExcerptLines,
          root,
        });
      return rpcResponse(message.id, toolResult(value));
    } catch (err) {
      return rpcResponse(message.id, { ...toolResult({ error: err.message }), isError: true });
    }
  };
}

export function runMcpServer({ root, config, graphPath, input = process.stdin, output = process.stdout } = {}) {
  const handle = createMcpHandler({ root, config, graphPath });
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  rl.on('line', async line => {
    if (!line.trim()) return;
    let message;
    try { message = JSON.parse(line); }
    catch { output.write(`${JSON.stringify(rpcError(null, -32700, 'Invalid JSON'))}\n`); return; }
    const result = await handle(message);
    if (result) output.write(`${JSON.stringify(result)}\n`);
  });
  return rl;
}
