# DocLint

**Doclint** is a small program that lints Playwright's documentation against
Playwright's source code.

Doclint works in a few steps:

1. Read sources in `lib/` folder, parse AST trees and extract public API
2. Read sources in `docs/` folder, render markdown to HTML, use playwright to traverse the HTML
  and extract described API
3. Compare one API to another

Doclint is also responsible for general markdown checks, most notably for the table of contents
relevancy.

## Running

```bash
npm run doc
```

## Tests

Doclint has its own set of jasmine tests, located at `utils/doclint/test` folder.

To execute tests, run:

```bash
npm run test-doclint
```
