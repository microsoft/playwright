# Documentation Graph and Model Access Architecture

This project uses a small retrieval layer so coding questions can access precise documentation without loading the entire documentation set into model context. The same architecture is intended to support Playwright, other programming languages, and other frameworks.

## 1. System overview

```text
Source documentation
  NOTES.md · API_REFERENCE.md · examples/
                 │
                 ▼
       Graphify indexer
       tools/graphify-docs.mjs
                 │
                 ▼
          DOC_GRAPH.json
   documents · sections · topics · examples
                 │
                 ▼
        Graph query / routing
       tools/query-doc-graph.mjs
                 │
                 ▼
       Targeted source excerpts
                 │
                 ▼
       AGY model invocation
       Gemini 3.7 Flash
                 │
                 ▼
        Grounded coding answer
```

`DOC_GRAPH.json` is an index, not a replacement for the source documents. The source Markdown and examples remain authoritative.

## 2. Graph contents

The graph currently contains four node types:

| Node type | Purpose |
| --- | --- |
| `document` | Identifies `NOTES.md` or `API_REFERENCE.md`. |
| `section` | Stores the heading, source file, and exact line number. |
| `topic` | Provides keyword routing for concepts and API names. |
| `example` | Identifies a runnable example and its topic words. |

Edges currently express:

| Edge | Meaning |
| --- | --- |
| `document → contains → section` | A source document contains a section. |
| `section → about → topic` | A section is relevant to a topic. |
| `example → illustrates → topic` | An example demonstrates a topic. |

The current index contains 1,700 nodes and 3,840 relationships across 2 documents and 38 examples (949 sections and 711 topics).

## 3. Retrieval workflow

For each question:

1. Search the graph for matching topics.
2. Resolve topic edges to source sections and examples.
3. Read only the selected source ranges.
4. Build a grounded prompt containing those excerpts and their file/line references.
5. Ask AGY to answer with citations and to identify uncertainty.

The complete documentation is used only when targeted retrieval is insufficient. A normal question should use hundreds or a few thousand tokens, not the 17–21k tokens required to load both primary documents.

Example:

```sh
node tools/query-doc-graph.mjs agi-training-notes multi-tab
```

## 4. Model boundary

AGY is the model-access boundary for this project. The selected model is:

```text
gemini-3.7-flash-medium
```

The graph and retrieval layer must remain model-independent. A future model can receive the same selected excerpts and source references without changing the graph format.

The model must not be given the graph as a substitute for source text. The graph chooses the context; the source excerpts support the answer.

## 5. Documentation API

The command-line tools were the original prototype. The reusable service wrapper
(`../doc-graph/`) now exposes the same operations:

```text
GET  /search?q=shadow+dom
GET  /context?q=shadow+dom
GET  /health
```

Responsibilities:

```text
/search  → graph matches and source references only
/context → graph matches plus bounded source excerpts
/health  → service liveness and project name
```

The API returns source file names, line numbers, selected node IDs, matched
topics, and provenance so answers remain auditable. Model invocation is out of
scope for the service; it returns excerpts for an external model to consume.

## 6. Extending to other languages

Each language or framework should have its own documentation bundle and graph, while sharing the schema and retrieval protocol:

```text
docs/
├── playwright/
│   ├── NOTES.md
│   ├── API_REFERENCE.md
│   ├── DOC_GRAPH.json
│   └── examples/
├── python/
│   ├── NOTES.md
│   ├── API_REFERENCE.md
│   ├── DOC_GRAPH.json
│   └── examples/
└── rust/
    ├── NOTES.md
    ├── API_REFERENCE.md
    ├── DOC_GRAPH.json
    └── examples/
```

The shared contract is:

```text
question
  → graph routing
  → bounded source excerpts
  → model answer
  → exact references and uncertainty
```

Language-specific indexers may add richer nodes—classes, functions, modules, traits, packages, error types, or version constraints—but should preserve the common `document`, `section`, `topic`, and `example` concepts.

## 7. Versioning and trust rules

- Source documents are authoritative; generated graph files are rebuildable artifacts.
- The graph must be rebuilt whenever headings or examples change.
- API answers should include the documentation version or pinned source revision when available.
- Examples marked documentation-only must not be presented as executable proof.
- If the graph finds no strong match, the model must say so rather than inventing an API.
- External web documentation is a fallback, not the first source, when local project notes exist.

## 8. Rebuild commands

From `agi-training-notes`:

```sh
# Prototype (retained for reference).
node tools/graphify-docs.mjs
node tools/query-doc-graph.mjs agi-training-notes <topic words>

# Reusable package (recommended).
node ../doc-graph/bin/doc-graph.mjs build --root .
node ../doc-graph/bin/doc-graph.mjs search <query> --root .
node ../doc-graph/bin/doc-graph.mjs context <query> --root .
node ../doc-graph/bin/doc-graph.mjs serve --root . --port 8080
```

## 9. Reusable package

The indexer, query engine, CLI, and HTTP API are extracted into `../doc-graph/`,
a dependency-free, model-independent Node package. Projects opt in with a
`doc-graph.config.json` that declares document globs, example globs, a project
name, and an output path, so a project with a different documentation layout
indexes without source changes. A minimal second-project fixture lives at
`../doc-graph/test/fixtures/second-project/`. Generated graphs remain
rebuildable artifacts, kept separate from source documentation.
