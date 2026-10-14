This directory holds the current test runner, installed from the local build:
- `PW_BUN=1 npm run ttest` packs `playwright-core`, `playwright` and `@playwright/test` into `.staging` and installs them here.
- Inner test projects and their CLI load these copies, not the `packages/` sources.
