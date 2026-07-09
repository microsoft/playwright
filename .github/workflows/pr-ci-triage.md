# PR CI Failure Verdict

Come up with a verdict on a PR's failing CI tests: **are they likely caused by this PR, or
pre-existing flakes / infra noise?**
We want a verdict for the failures. If you can trivially come up with a fix, you can also propose it.
A merged report is posted on the PR by the `github-actions[bot]` comment, look at the most recent one.

No failing tests (only flaky/interrupted) → nothing to triage. Group the same test failing across browsers as one story.

**Hard rule for calling something a flake:** you must find the *same test* failing or flaking somewhere the PR can't be responsible for. Query the aggregated CI results via the `playwright-test-results` skill — look for the same `(project_name, file, test_title)` failing on other SHAs/PRs, or flipping verdict across runs. Divergence ("different tests, different browsers/OSes") and a plausible signature (timeout, element-not-found) are **not** enough on their own — flakes are often surprising and unrelated to the test's subject. No such evidence found → the failure is **uncertain**, not a flake.

Some things to look into per failure (or group):

- **Does the diff reach it?** The file under test, a feature it exercises, a shared helper it imports, or the product code path it asserts on. Network test vs. a docs-only PR → unrelated; click test vs. a PR rewriting input dispatch → suspicious.
- **Has this test flaked before?** Go look (see the hard rule above): use the `playwright-test-results` skill to check the same test's history across runs. Run the skill's `update` step first — the shared snapshot lags a few hours, so the freshest runs (including this PR's own) may not be in it yet. This is the only thing that proves a flake.
- **Flake/infra signature?** Timeouts, `Target closed`, browser launch/download errors, network hiccups, or the same test also flaking (passed on retry) in this report. A supporting hint, never proof on its own.
- **Browser/platform divergence.** One browser only, in code the PR didn't touch for that engine → leans flake; explainable on every browser → leans caused-by-PR. A weak hint only.

## Verdict format

Lead with a single traffic-light headline so the signal is readable at a glance, then put the per-group detail in a collapsible `<details>`:

- 🔴 **Red** — at least one failure is caused by this PR.
- 🟡 **Yellow** — uncertain; you couldn't prove it either way.
- 🟢 **Green** — no real failures, or all confirmed pre-existing flakes / infra. The PR is clear.

The overall colour is the worst of the per-group calls (any red → red, else any yellow → yellow, else green).

Inside the collapsible, make an overall assessment of the PR's impact on CI failures, then segment by each failure/group as **caused by this PR** (which change, why), **pre-existing flake / infra** (cite where else the same test failed/flaked), or **uncertain** (what you'd need to be sure).

Example (a red verdict — one real failure plus flakes):

```markdown
## 🔴 One failure looks caused by this PR

`page-request-gc.spec.ts:36` fails on Firefox because the fix here is Chromium-only.

<details>
<summary>Details</summary>

**Caused by this PR**

- `[firefox-page] › page/page-request-gc.spec.ts:36 › should collect element retained by locator hit-target interceptor after detach` — the test the PR adds. The retention fix lives in `crPage.ts::requestGC`, which is Chromium-specific, so the element is still retained under Firefox and `weakRef.deref()` isn't `undefined`. The test has no browser gate, so it runs and fails on Firefox. Gate it to Chromium, e.g. `test.skip(browserName === 'firefox')`.

**Pre-existing flake / infra**

- `[chromium] › mcp/annotate.spec.ts:230 › should capture annotations via show --annotate` (+ `:496`) — pre-existing flake. Across the test-results DB this test flips verdict: **failed 7 of 54 runs (13%), passed the other 47**, on SHAs unrelated to this PR. This PR only touches the hit-target interceptor and Chromium `requestGC`, which the MCP annotate flow doesn't exercise.

</details>
```
