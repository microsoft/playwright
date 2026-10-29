---
name: playwright-triage
description: Triage and fix one microsoft/playwright issue, or do a maintainer's task, unattended inside the Issue triage GitHub Actions workflow (.github/workflows/triage.yml), which a needs-triage, needs-triage-mac or needs-triage-win label starts, or a maintainer starts by hand with an issue, a task or both. Reproduces the issue on the runner, then leaves a verified fix proposal for the workflow to open as a draft PR, a test that covers a scenario that did not reproduce, an investigation note for it to post on the issue, or a browser bug report for it to route to crbug.com or microsoft/playwright-browsers. Only for that workflow.
---

# Playwright Issue Triage

You run unattended in the [Issue triage](../../../.github/workflows/triage.yml) workflow of
`microsoft/playwright`. First read the shared guide, `$AGENT_GUIDES_DIR/triage.md`, which is
[.github/actions/run-agent/guides/triage.md](../../../.github/actions/run-agent/guides/triage.md) in
this repo, and then [AGENTS.md](../../../AGENTS.md), both in full. The guide says how to triage an
issue in any Playwright repo. AGENTS.md says how to build, test and lint this one. This file covers
what neither has: the checkout, how to run a published version, the reports from the ports, and the
outcome that this repo adds, a browser bug report.

## The checkout

`$REPO_DIR` is the checkout of `microsoft/playwright` that the guide describes. Chromium, Firefox
and WebKit are installed. The clone is shallow: run `git fetch --unshallow --tags origin` in it
before you bisect or use `git tag --contains`.

## Published versions

To run a published version, for example to bisect, create `$SCRATCH_DIR/playwright-<n>/<version>/`
and run `npm init -y && npm i -D @playwright/test@<version> && npx playwright install` there. Add a
`playwright.config.ts` with one project, and run the same spec with `PLAYWRIGHT_HTML_OPEN=never`. To
find the change between two releases, diff `node_modules/playwright-core/lib/` (or
`playwright/lib/`) between them, and match it to commits in the checkout with
`git log v<good>..v<bad> -- <path>`.

## Reports from the ports

The ports, `playwright-python`, `playwright-java` and `playwright-dotnet`, drive the same Node
driver. For a report from a port, reproduce the same calls here directly. This repo is where the fix
lands.

## Report a browser bug

When the root cause is in Chromium, Firefox or WebKit, upstream or in the patches in
`microsoft/playwright-browsers`, and the fix belongs there and not in this repo, write the bug
report for the owner of the browser. The workflow routes it. Create `$OUTPUT_DIR/browser/` with:

- `report.md`: the body of the report, for an engineer of that browser who did not read the
  Playwright issue: what fails, expected versus actual, the browser version or build, the platform,
  the root cause when you found it, and a repro that they can run. A Chromium report goes upstream,
  so a repro without Playwright, a plain page or CDP commands, is worth the effort. A Firefox or
  WebKit report goes to our browser team: the condensed test from the checkout is the right repro.
  Say if the bug is upstream or in our patches when you know.
- `report.json`: `{"browser": "chromium" | "firefox" | "webkit", "title": "...", "platform": "..."}`.
  The title names the browser and what fails, in at most 256 characters, for example
  `WebKit: route.fulfill() ignores the charset in Content-Type`. `platform` is optional. When the
  bug shows on one platform only, name its label in `microsoft/playwright-browsers`: one of
  `platform-ubuntu-22.04`, `platform-ubuntu-24.04`, `platform-ubuntu-26.04`, `platform-debian-12`,
  `platform-debian-13`, `platform-mac-15`, `platform-mac-26`, each also with an `-arm64` suffix, or
  `platform-win64`. The workflow drops a label that it does not know.

The workflow reads the report after the run and acts in the channel of the browser:

- **Chromium**: bugs go to crbug.com, where only a person can file. The comment job appends the
  title and the body to your comment, for a maintainer to file.
- **Firefox and WebKit**: a separate job files the issue in `microsoft/playwright-browsers`, with
  the label `browser-firefox` or `browser-webkit` and the platform label, and links this issue from
  it. The comment job appends `Blocked-by: <issue url>` to your comment. A label that is applied
  again after an earlier run does not file twice: the job links the open issue that it already
  filed.

Write the comment as the note: the verdict, the evidence, and that the bug is in the browser. Do not
paste the report into it, and do not add a `Blocked-by:` line yourself. The workflow does both.

Write `report.json` last, when `report.md` and the comment are done. Like `proposal.json`, it marks
the report as ready.

## PRs from third parties

Do not run a PR that changes `package.json`, a lockfile, an install script, `utils/`, `.github/`,
`browser_patches/`, or a `DEPS.list` file in a way that widens an import boundary.
