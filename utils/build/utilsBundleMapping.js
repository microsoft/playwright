// Single source of truth for the mapping between idiomatic npm imports and
// the keys exported from `playwright-core/lib/utilsBundle`.
//
// Each entry: package specifier → { default?, named?: {srcName: bundleKey}, namespace? }
// `lockfile` and `extract` have no clean npm equivalent (they wrap in-tree
// third_party files) and intentionally remain as direct utilsBundle imports.

/** @type {Record<string, { default?: string, named?: Record<string,string>, namespace?: string }>} */
const MAPPING = {
  'colors/safe': { default: 'colors' },
  'debug': { default: 'debug' },
  'ini': { namespace: 'ini' },
  'diff': { namespace: 'diff' },
  'dotenv': { default: 'dotenv' },
  'proxy-from-env': { named: { getProxyForUrl: 'getProxyForUrl' } },
  'https-proxy-agent': { named: { HttpsProxyAgent: 'HttpsProxyAgent' } },
  'jpeg-js': { default: 'jpegjs' },
  'mime': { default: 'mime' },
  'minimatch': { default: 'minimatch' },
  'open': { default: 'open' },
  'pngjs': { named: { PNG: 'PNG' } },
  'commander': { named: { program: 'program', Option: 'ProgramOption' } },
  'progress': { default: 'progress' },
  'socks-proxy-agent': { named: { SocksProxyAgent: 'SocksProxyAgent' } },
  'ws': {
    default: 'ws',
    named: { WebSocketServer: 'wsServer' },
  },
  'yaml': { default: 'yaml' },
  'json5': { default: 'json5' },
  'source-map-support': { default: 'sourceMapSupport' },
  'stoppable': { default: 'stoppable' },
  'enquirer': { default: 'enquirer' },
  'chokidar': { default: 'chokidar' },
  'get-east-asian-width': { namespace: 'getEastAsianWidth' },
  'yazl': { namespace: 'yazl' },
  'yauzl': { default: 'yauzl', namespace: 'yauzl' },
  'zod': { namespace: 'z' },
  'zod-to-json-schema': { named: { zodToJsonSchema: 'zodToJsonSchema' } },
  '@modelcontextprotocol/sdk/client/index.js': { named: { Client: 'Client' } },
  '@modelcontextprotocol/sdk/server/index.js': { named: { Server: 'Server' } },
  '@modelcontextprotocol/sdk/client/sse.js': { named: { SSEClientTransport: 'SSEClientTransport' } },
  '@modelcontextprotocol/sdk/server/sse.js': { named: { SSEServerTransport: 'SSEServerTransport' } },
  '@modelcontextprotocol/sdk/client/stdio.js': { named: { StdioClientTransport: 'StdioClientTransport' } },
  '@modelcontextprotocol/sdk/server/stdio.js': { named: { StdioServerTransport: 'StdioServerTransport' } },
  '@modelcontextprotocol/sdk/server/streamableHttp.js': { named: { StreamableHTTPServerTransport: 'StreamableHTTPServerTransport' } },
  '@modelcontextprotocol/sdk/client/streamableHttp.js': { named: { StreamableHTTPClientTransport: 'StreamableHTTPClientTransport' } },
  '@modelcontextprotocol/sdk/types.js': {
    named: {
      CallToolRequestSchema: 'CallToolRequestSchema',
      ListRootsRequestSchema: 'ListRootsRequestSchema',
      ListToolsRequestSchema: 'ListToolsRequestSchema',
      PingRequestSchema: 'PingRequestSchema',
      ProgressNotificationSchema: 'ProgressNotificationSchema',
    },
  },
  // Transitive deps of in-tree third_party extractZip.ts / lockfile.ts.
  // Callers use `@utils/third_party/*` which routes through coreBundle.utils;
  // their transitive imports of these npm packages need to stay external and
  // come from utilsBundle just like any other vendored package.
  'graceful-fs': { default: 'gracefulFs', namespace: 'gracefulFs' },
  'retry': { default: 'retry' },
  'signal-exit': { default: 'onExit' },
  'get-stream': { default: 'getStream' },
};

const VENDORED_PACKAGES = new Set(Object.keys(MAPPING));

module.exports = { MAPPING, VENDORED_PACKAGES };
