# Milestone: Reusable Documentation Graph Service

Status: complete
Assignee: opencode

Completion: Implemented in `../doc-graph/`; 30 focused tests pass.

Follow-up: MCP stdio support added with `doc_graph_search` and `doc_graph_context` tools.

## Objective

Turn the documentation graph prototype into a reusable, model-independent tool that other projects can index and query.

## Scope

- Extract graph indexing and retrieval into a reusable package or library.
- Support configurable document globs, examples, project names, and output paths.
- Preserve provenance, source line references, and graph schema versioning.
- Provide CLI commands for build and search/context retrieval.
- Provide a small HTTP API with `/search` and `/context` endpoints.
- Keep model invocation separate from graph/indexing code.
- Add tests and a minimal example project showing reuse outside Playwright.
- Update documentation and rebuild instructions.

## Acceptance criteria

- A second project with a different documentation layout can be indexed without modifying source code.
- Search returns ranked, bounded references with file paths, line numbers, examples, and provenance.
- Context retrieval returns source excerpts suitable for prompting an external model.
- CLI and HTTP API work from a clean install.
- Automated tests cover indexing, querying, stale/missing files, and provenance.
- Existing Playwright notes still build and answer representative queries.

## Constraints

- Do not execute browser examples or download browser binaries.
- Do not hardcode Gemini, OpenAI, or another model provider into the core library.
- Keep generated graph artifacts rebuildable and clearly separated from source documentation.
