# Documentation graph

`DOC_GRAPH.json` is a compact routing index for this directory. It does not replace `NOTES.md`, `API_REFERENCE.md`, or the examples; those remain the source of truth.

The graph records:

- a schema version
- a `generated_at` timestamp
- the pinned upstream revision when the notes expose one
- per-document provenance in `source_documents`

The graph contains three node types:

- `document` and `section` nodes point to exact source files and line numbers.
- `topic` nodes provide keyword routing.
- `example` nodes connect runnable examples to their topic words.

Use the graph to select a small context window, then read the referenced source sections. A model prompt should receive the selected excerpts, not the entire graph or documentation set. Keep the answer grounded in the cited file and line references.

## Rebuild

The original prototype indexer is retained at `tools/graphify-docs.mjs`:

```sh
node tools/graphify-docs.mjs
```

The reusable, model-independent implementation now lives in `../doc-graph/`. This directory opts in via `doc-graph.config.json`, so the same graph can be rebuilt with the shared tool:

```sh
node ../doc-graph/bin/doc-graph.mjs build --root .
```

## Query

```sh
# Prototype routing query.
node tools/query-doc-graph.mjs agi-training-notes multi-tab

# Reusable ranked search (bounded references with file/line/provenance).
node ../doc-graph/bin/doc-graph.mjs search "shadow dom" --root .

# Reusable context retrieval (references plus source excerpts).
node ../doc-graph/bin/doc-graph.mjs context "shadow dom" --root .

# HTTP API.
node ../doc-graph/bin/doc-graph.mjs serve --root . --port 8080
```

The HTTP API exposes `GET /search?q=...` and `GET /context?q=...`. See `../doc-graph/README.md` for the full library, CLI, and API reference.
