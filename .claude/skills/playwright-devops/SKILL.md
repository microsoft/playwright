---
name: playwright-devops
description: DevOps workflows for Playwright - CI failure analysis, workflow debugging, and release operations.
user_invocable: true
---

# Playwright DevOps

## Guides

- [PR CI Failure Verdict](pr-ci-triage.md) — assess whether a PR's CI test failures are likely caused by that PR
- [CI Commit Failure Report](commit-failures.md) — analyze GitHub Actions failures for the last commit on main
- [fetch-commit-logs.sh](fetch-commit-logs.sh) — script to download failed job logs into `~/tmp/commit-<sha>/`
