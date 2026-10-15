This directory holds the current test runner for bun runs, installed from the local build:
- `npm run stage-bun-runner` packs `playwright-core`, `playwright` and `@playwright/test` into `.staging` and installs them here. Run it after each build.
- `npm run ttest-bun` runs the inner test projects and their CLI with these copies.
- `bun run --bun ctest-bun` runs the library tests with this runner. During the run, `tests/node_modules` links here, so test files load the same copies as the runner.
