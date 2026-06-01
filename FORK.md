# playwright-api-trace-viewer

This repository is a fork of [microsoft/playwright](https://github.com/microsoft/playwright). It is **not** affiliated with or endorsed by Microsoft.

Upstream Playwright remains the official browser automation framework. This fork exists to ship an enhanced **trace viewer** for **API test debugging**, inspired by tools like [cypress-plugin-api](https://github.com/filiphric/cypress-plugin-api).

## What changed

All fork-specific work lives under `packages/trace-viewer/src/ui/` unless noted otherwise.

### New files

| File | Purpose |
|------|---------|
| `apiCallUtils.ts` | Detect API steps, resolve request/response from attachments or network, dedupe nested steps |
| `apiCallDetails.tsx` / `apiCallDetails.css` | Cypress-style request/response panel and global “all API calls” viewport |
| `assertionUtils.ts` | Cypress-style `assert` rows in the Actions tree |
| `logUtils.ts` | Cypress-style `log` rows in the Actions tree |

### Modified files

| File | Purpose |
|------|---------|
| `actionList.tsx` / `actionList.css` | Per-step API expand, assert/log badges, expandable long assertion labels |
| `snapshotTab.tsx` | Toolbar toggles: `{}` (all API calls) and globe (auto-show selected API) |
| `workbench.tsx` | State wiring for API viewport toggles and expanded/collapsed API panels |

### Features

- **Per-step API details** — `{}` on HTTP steps opens request/response (headers, body, status, duration)
- **Global API viewport** — stack all API calls or auto-show the selected step’s call
- **Assertions in Actions** — green `assert` steps with readable labels and click-to-expand long messages
- **Log steps in Actions** — blue `log` steps (used with companion test helpers that emit `test.step('log …')`)
- **Hook visibility** — API steps inside `beforeAll` / `afterEach` appear when tests use the Playwright `request` fixture and labeled hook steps
- **Deduped global API list** — nested `test.step` / attach rows no longer repeat the same endpoint

## Build & run trace viewer

```bash
node utils/build/build.js trace-viewer
node packages/playwright-core/cli.js show-trace /path/to/trace.zip
```

## Hosted trace viewer (GitHub Pages)

A static build is published from this repository using [GitHub Pages](https://docs.github.com/en/pages) (project site, no custom domain):

**https://a8trejo.github.io/playwright-api-trace-viewer/**

Open that URL and upload a `trace.zip` file, the same way you use [trace.playwright.dev](https://trace.playwright.dev/).

- **Workflow:** [`.github/workflows/deploy_trace_viewer_pages.yml`](.github/workflows/deploy_trace_viewer_pages.yml) (runs on pushes to `main` and on manual dispatch).
- **Pages source:** In the repo **Settings → Pages**, set **Build and deployment** to **GitHub Actions**.

## Companion test helpers

API test integration (Chai `expect` tracing, `logger.traces`, `assertExactProperties`, etc.) lives in a separate project and is not part of this fork.

## Upstream sync

To pull Microsoft Playwright updates (when using `upstream` remote):

```bash
git fetch upstream
git merge upstream/main
node utils/build/build.js trace-viewer
```

Resolve conflicts in `packages/trace-viewer/` carefully; prefer keeping fork features while adopting upstream fixes.

## License

This fork is distributed under the **Apache License 2.0**, same as upstream Playwright. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
