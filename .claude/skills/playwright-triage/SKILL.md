---
name: playwright-triage
description: Triage and fix one microsoft/playwright issue, or do a maintainer's task, unattended inside the Issue triage GitHub Actions workflow (.github/workflows/triage.yml), which a needs-triage, needs-triage-mac or needs-triage-win label starts, or a maintainer starts by hand with an issue, a task or both. Reproduces the issue on the runner, then leaves a verified fix proposal for the workflow to open as a draft PR, a test that covers a scenario that did not reproduce, an investigation note for it to post on the issue, or a browser bug report for it to file in microsoft/playwright-browsers or for a maintainer to file at crbug.com. Only for that workflow.
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
report for the owner of the browser in `$OUTPUT_DIR/browser/report.md`: the body of the report, for
an engineer of that browser who did not read the Playwright issue. Say what fails, expected versus
actual, the browser version or build, the platform, the root cause when you found it, and a repro
that they can run. A Chromium report goes upstream, so a repro without Playwright, a plain page or
CDP commands, is worth the effort. A Firefox or WebKit report goes to our browser team: the
condensed test from the checkout is the right repro. Say if the bug is upstream or in our patches
when you know.

The title names the browser and what fails, in at most 256 characters, for example
`WebKit: route.fulfill() ignores the charset in Content-Type`.

Where the report goes depends on the browser:

- **Firefox and WebKit**: add an `issue` call for `microsoft/playwright-browsers`, typed `Issue` in
  `$AGENT_GUIDES_DIR/calls.d.ts`. This is the only repo where this run allows an `issue` call.

  ```json
  {
    "call": "issue",
    "repo": "microsoft/playwright-browsers",
    "title": "WebKit: route.fulfill() ignores the charset in Content-Type",
    "bodyFile": "browser/report.md",
    "labels": ["browser-webkit", "platform-mac-15"],
    "filedFor": "https://github.com/microsoft/playwright/issues/<n>"
  }
  ```

  The first label is `browser-firefox` or `browser-webkit`. Add a platform label only when the bug
  shows on one platform only: one of `platform-ubuntu-22.04`, `platform-ubuntu-24.04`,
  `platform-ubuntu-26.04`, `platform-debian-12`, `platform-debian-13`, `platform-mac-15`,
  `platform-mac-26`, each also with an `-arm64` suffix, or `platform-win64`. The publish job drops a
  label that the repo does not have. End `report.md` with the line
  `Playwright issue: <issue url>` and the footer, and put the same URL in `filedFor`: when an open
  issue there already has it, after an earlier run, the job uses that issue and files no new one.
  Put `Blocked-by: {{issue}}` in your comment, before the footer.
- **Chromium**: bugs go to crbug.com, where only a person can file. Put the report at the end of
  your comment, for a maintainer to file, in this form:

  `````markdown
  Chromium bug report, for a maintainer to file at https://crbug.com/new:

  **Title:** <title>

  <details>
  <summary>Body</summary>

  ````markdown
  <the content of report.md>
  ````

  </details>
  `````

Write the comment as the note: the verdict, the evidence, and that the bug is in the browser. Add
the `issue` call when the report and the comment are done.

## PRs from third parties

Do not run a PR that changes `package.json`, a lockfile, an install script, `utils/`, `.github/`,
`browser_patches/`, or a `DEPS.list` file in a way that widens an import boundary.
