# doc-graph

A model-independent documentation graph indexer and retrieval service.

`doc-graph` turns a project's Markdown documentation and runnable examples into a
compact, rebuildable routing graph (`DOC_GRAPH.json` by default), then exposes
ranked search and bounded source-excerpt retrieval through a CLI and a small HTTP
API. It never invokes a model: it only selects and returns grounded source
references that an external model can be prompted with.

## Concepts

| Node type | Purpose |
| --- | --- |
| `document` | A source document (e.g. `NOTES.md`). |
| `section`  | A heading with its source file and exact line number. |
| `topic`    | A keyword used to route queries. |
| `example`  | A runnable example file and its title. |

| Edge | Meaning |
| --- | --- |
| `document → contains → section` | A document contains a section. |
| `section → about → topic` | A section is relevant to a topic. |
| `example → illustrates → topic` | An example demonstrates a topic. |

The graph records a schema version, a generation timestamp, per-document
provenance (source commit and date when present), and source line references.

## Install

The package is dependency-free (Node.js built-ins only) and works from a clean
checkout:

```sh
npm install          # nothing extra needed
node doc-graph/bin/doc-graph.mjs --help
```

To expose the `doc-graph` command on your PATH:

```sh
npm link             # from within doc-graph/, or
npm install -g .
```

## Configuration

A project opts in by adding a `doc-graph.config.json` (or `.mjs`) to its root:

```json
{
  "project": "playwright",
  "documents": ["NOTES.md", "API_REFERENCE.md"],
  "examples": ["examples/*.js"],
  "output": "DOC_GRAPH.json",
  "excerptLines": 80,
  "maxExcerptLines": 200
}
```

- `project` — name recorded in the graph (defaults to the directory name).
- `documents` — glob(s) of source documents to index.
- `examples` — glob(s) of runnable example files.
- `output` — where to write the graph artifact (kept separate from source docs).
- `provenance` — optional `{ "commitPattern", "datePattern" }` regexes used to
  read provenance from document text.

## CLI

```sh
# Build the graph for the current directory.
doc-graph build

# Ranked, bounded references.
doc-graph search "shadow dom"

# Ranked references plus source excerpts, ready for a model prompt.
doc-graph context "shadow dom"

# Start the HTTP API.
doc-graph serve --port 8080

# Start the MCP stdio server for internal tools.
doc-graph-mcp /path/to/project
```

All commands accept `--root <dir>`, `--config <path>`, `--project <name>`,
`--output <path>`, and repeatable `--documents <glob>` / `--examples <glob>`.

## HTTP API

```text
GET /search?q=<query>&limit=<n>    → ranked references (file, line, provenance)
GET /context?q=<query>&limit=<n>   → references plus bounded source excerpts
GET /health                        → { ok, project }
```

## MCP

`doc-graph-mcp` exposes the same read-only retrieval surface over MCP stdio.
The server implements `initialize`, `tools/list`, `tools/call`, and `ping`.
Internal tools can launch it as a subprocess; all protocol traffic stays on
stdout and diagnostics should be handled by the parent process.

Available tools:

- `doc_graph_search` — ranked documentation and example references.
- `doc_graph_context` — ranked references with bounded source excerpts.

Example client configuration:

```json
{
  "mcpServers": {
    "project-docs": {
      "command": "doc-graph-mcp",
      "args": ["/path/to/project"]
    }
  }
}
```

## Library

```js
import { buildGraph, loadGraph, search, retrieveContext } from 'doc-graph';

const result = buildGraph('/path/to/project', {
  project: 'example',
  documents: ['NOTES.md'],
  examples: ['examples/*.js'],
  output: 'DOC_GRAPH.json',
});

const graph = loadGraph('/path/to/project', 'DOC_GRAPH.json');
const refs = search(graph, 'shadow dom', { limit: 20 });
const context = retrieveContext(graph, 'shadow dom', { limit: 10, root: '/path/to/project' });
```

## Tests

```sh
node --test doc-graph/test/
```
