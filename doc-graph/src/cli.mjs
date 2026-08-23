import path from 'node:path';
import { DEFAULT_CONFIG, loadConfig, resolveConfig, mergeConfig } from './config.mjs';
import { buildGraph, loadGraph } from './indexer.mjs';
import { search, retrieveContext } from './query.mjs';
import { createServer } from './server.mjs';

const HELP = `doc-graph — model-independent documentation graph indexer and retrieval

Usage:
  doc-graph build   [options]
  doc-graph search  <query> [options]
  doc-graph context <query> [options]
  doc-graph serve   [options]

Commands:
  build     Index documents and examples, writing the graph artifact.
  search    Ranked, bounded references for a query.
  context   Ranked references plus source excerpts for prompting a model.
  serve     Start an HTTP API with /search and /context endpoints.

Common options:
  --root <dir>            Project root directory (default: cwd).
  --config <path>         Config file (doc-graph.config.json or .mjs).
  --project <name>        Project name recorded in the graph.
  --output <path>         Graph artifact output path (default: DOC_GRAPH.json).
  --documents <glob>      Document glob; may be repeated.
  --examples <glob>       Example glob; may be repeated.
  --limit <n>             Max references to return.
  --port <n>              HTTP port for serve (default: 8080).
  --help, -h              Show this help.
`;

function parseArgs(argv) {
  const args = { _: [], options: {} };
  const flagNames = new Set(['root', 'config', 'project', 'output', 'documents', 'document', 'examples', 'example', 'limit', 'port', 'help', 'h']);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.options.help = true;
      continue;
    }
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (!flagNames.has(key))
        throw new Error(`Unknown option: ${arg}`);
      if (key === 'help') {
        args.options.help = true;
        continue;
      }
      const value = argv[i + 1];
      if (value === undefined)
        throw new Error(`Missing value for ${arg}`);
      if (key === 'documents' || key === 'document' || key === 'examples' || key === 'example') {
        (args.options[key] ??= []).push(value);
      } else {
        args.options[key] = value;
      }
      i++;
      continue;
    }
    args._.push(arg);
  }
  return args;
}

function applyCliOverrides(config, options) {
  const overrides = {};
  if (options.project !== undefined)
    overrides.project = options.project;
  if (options.output !== undefined)
    overrides.output = options.output;
  if (options.documents !== undefined)
    overrides.documents = [...(options.documents ?? []), ...(options.document ?? [])];
  else if (options.document !== undefined)
    overrides.documents = options.document;
  if (options.examples !== undefined)
    overrides.examples = [...(options.examples ?? []), ...(options.example ?? [])];
  else if (options.example !== undefined)
    overrides.examples = options.example;
  return mergeConfig(config, overrides);
}

export async function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.options.help || args._.length === 0) {
    process.stdout.write(HELP);
    return 0;
  }

  const command = args._[0];
  const rest = args._.slice(1);
  const root = path.resolve(args.options.root ?? process.cwd());
  const { config: fileConfig } = await loadConfig(root, args.options.config);
  const config = resolveConfig(root, fileConfig, applyCliOverrides(fileConfig ?? DEFAULT_CONFIG, args.options));

  switch (command) {
    case 'build': {
      const result = buildGraph(root, config);
      process.stdout.write(`${JSON.stringify({ output: result.output, stats: result.stats }, null, 2)}\n`);
      return 0;
    }
    case 'search': {
      const query = rest.join(' ').trim();
      if (!query)
        throw new Error('search requires a query');
      const graph = loadGraph(root, config.output);
      const result = search(graph, query, args.options.limit ? { limit: Number(args.options.limit) } : {});
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return 0;
    }
    case 'context': {
      const query = rest.join(' ').trim();
      if (!query)
        throw new Error('context requires a query');
      const graph = loadGraph(root, config.output);
      const result = retrieveContext(graph, query, {
        limit: args.options.limit ? Number(args.options.limit) : 10,
        excerptLines: config.excerptLines,
        maxExcerptLines: config.maxExcerptLines,
        root,
      });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return 0;
    }
    case 'serve': {
      const port = Number(args.options.port ?? 8080);
      const server = createServer({ root, config, graphPath: config.output });
      await new Promise(resolve => server.listen(port, resolve));
      process.stdout.write(`doc-graph serving ${config.project} on http://localhost:${port}\n`);
      process.stdout.write('  GET /search?q=<query>&limit=<n>\n');
      process.stdout.write('  GET /context?q=<query>&limit=<n>\n');
      return 'serving';
    }
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}
