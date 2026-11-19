---
name: playwright-bisect-chromium
description: Bisect a Chromium regression down to the upstream commit with the prebuilt per-commit Chrome for Testing builds - no Chromium checkout and no build. Use when a test or a repro passes on an older Chromium and fails on a newer one, for example on a Chromium roll PR or a tip-of-tree roll PR.
user_invocable: true
---

# Bisecting Chromium

Playwright's Chromium is Chrome for Testing (CfT), downloaded from Google. There is no patch and no
source tree to bisect here. Google publishes a CfT build for almost every trunk commit position in
the `chrome-for-testing-per-commit-public` bucket, and
[`utils/bisect-chromium.mjs`](../../../utils/bisect-chromium.mjs) does a binary search over those
builds between a known-good and a known-bad revision. It runs a check command against each build,
with `CRPATH` set to the executable of the build. Each step downloads one build of about 130 MB. A
whole roll is about 8000 positions, that is about 13 steps, so a bisect takes minutes.

## Find the two revisions

The script takes a revision as a Chrome version (`159.0.8154.6`) or as a trunk commit position
(`1739869`, the number in `https://crrev.com/1739869`). It resolves a version to the position that
the release branch of the version was cut from.

- **Roll PR** (`feat(chromium): roll to <version>`, branch `roll-chromium/<version>`): the
  description has the line `Version: <old> → <new>`. `<old>` is `--good`, `<new>` is `--bad`. A
  tip-of-tree roll PR (`feat(chromium-tip-of-tree): roll to <version> - DO NOT MERGE`) has the same
  line.
- **A roll that merged**: `git log -p -- packages/playwright-core/browsers.json` shows each change of
  the `browserVersion` of `chromium`.
- **Anything else with a version**: a `Chrome/154.0.8037.0` user agent, `browser.version()`, a bug
  report. Pass the version as it is.

Not every position has a build. In bisect mode the script moves `--good` and `--bad` to the nearest
position that has a build, and prints a warning. Single-revision mode needs an exact position; to
see which positions near `1689400` have a build, open
`https://storage.googleapis.com/chrome-for-testing-per-commit-public/?delimiter=/&prefix=linux64/r&marker=linux64/r1689400`.

## Run it

Run from the root of the Playwright checkout, after `npm run build`. Always pass a check that runs
only the failing test. The default check, a full `npm run ctest`, is too slow for a bisect.

```bash
node utils/bisect-chromium.mjs --good 158.0.8127.18 --bad 159.0.8154.6 \
  --check 'npm run ctest -- tests/page/page-goto.spec.ts:42 --workers=1 --repeat-each=3'
```

- `--check` decides if a build is good: exit code 0 means good. The script runs it in the current
  directory with `CRPATH` set to the executable of the build and with `PLAYWRIGHT_HTML_OPEN=never`.
  Anything that reads `CRPATH` works: a Playwright test of this repo, or a script that launches
  `process.env.CRPATH`. When the failure is flaky, add `--repeat-each`, so that one pass by chance
  does not send the bisect the wrong way.
- The default build is `chrome-headless-shell`, which is what Playwright runs in headless mode. Pass
  `--headed` to the script to get the full Chrome build: for tests that you run with `--headed`, and
  for `channel: 'chromium'` (the full Chrome in the new headless mode).
- The script checks both ends before it starts. "Supposedly good revision is BAD" means that the
  regression is older than your range: pass an older `--good`. "Supposedly bad revision is GOOD"
  means that the check does not reproduce the failure: wrong headed or headless build, wrong test
  filter, a flaky test, or a regression on the release branch (see the limits below).
- Builds are cached in `<tmpdir>/chromium-r<position>-<headless|headed>/` and used again, so a second
  run with a different check is fast. Do not delete them during a bisect.
- Single-revision mode, `node utils/bisect-chromium.mjs 1739117 --check '...'`, checks one build and
  prints the full output of the check. Use it to confirm an end of the range by hand.
- There are builds for `linux64`, `mac-arm64` and `win64` only, and the script takes the builds of the
  machine that it runs on. A failure that occurs on one platform only needs a bisect on that
  platform.

## Read the result

```
=== RESULT ===
Last good build:  r1739116
First bad build:  r1739117
Commits: https://crrev.com/1739116 .. https://crrev.com/1739117
```

Two adjacent builds usually differ by one commit. When the positions between them have no build, the
range has a few commits. `https://crrev.com/<position>` opens the commit. For a range, take the two
hashes and read `https://chromium.googlesource.com/chromium/src/+log/<good-hash>..<bad-hash>`.

Report the commit that caused the regression: what it changed and why that breaks the test, with
the exact revisions and the check that you used. Then decide where the fix belongs:

- Playwright relied on behavior that Chromium changed on purpose: fix Playwright, in the roll PR or
  before it.
- Chromium has a bug: it goes to https://crbug.com/new with the commit and a repro that needs no
  Playwright. Only a person can file there, see "Browser bugs" in [AGENTS.md](../../../AGENTS.md).

## Limits

- Per-commit builds are trunk builds. A beta build is the trunk at the position of the version, plus
  the commits that were cherry-picked to its release branch after that. When a failure reproduces on
  the build of the roll, but not on the trunk build at the same position, the cause is on the release
  branch: read `https://chromium.googlesource.com/chromium/src/+log/refs/branch-heads/<branch>`,
  where `<branch>` is the third number of the version (`8154` for `159.0.8154.6`).
- Two versions of the same release branch (`159.0.8154.6` and `159.0.8154.13`) have the same position.
  The script stops with an error, because there are no per-commit builds between them. Read
  `https://chromium.googlesource.com/chromium/src/+log/<old-version>..<new-version>` instead.
