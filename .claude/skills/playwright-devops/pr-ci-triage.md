# PR CI Failure Verdict

Come up with a verdict on a PR's failing CI tests: **are they likely caused by this PR, or
pre-existing flakes / infra noise?**
We want a verdict for the failures. If you can trivially come up with a fix, you can also propose it.
A merged report is posted on the PR by the `github-actions[bot]` comment, look at the most recent one.

No failing tests (only flaky/interrupted) → nothing to triage. Group the same test failing across browsers as one story.

**Hard rule for calling something a flake:** you must find the *same test* failing or flaking somewhere the PR can't be responsible for. The reachable source is the `github-actions[bot]` test-report comment on other recent open PRs — pull a handful and look for the same test line (`:x:` failed, or under a flaky `<details>`). A known flaky-test issue also counts. Divergence ("different tests, different browsers/OSes") and a plausible signature (timeout, element-not-found) are **not** enough on their own — flakes are often surprising and unrelated to the test's subject. No such evidence found → the failure is **uncertain**, not a flake.

Some things to look into per failure (or group):

- **Does the diff reach it?** The file under test, a feature it exercises, a shared helper it imports, or the product code path it asserts on. Network test vs. a docs-only PR → unrelated; click test vs. a PR rewriting input dispatch → suspicious.
- **Has this test flaked before?** Go look (see the hard rule above): pull the `github-actions[bot]` report comments from a handful of other recent open PRs and grep for the same test line; also check for a known flaky-test issue. This is the only thing that proves a flake.
- **Flake/infra signature?** Timeouts, `Target closed`, browser launch/download errors, network hiccups, or the same test also flaking (passed on retry) in this report. A supporting hint, never proof on its own.
- **Browser/platform divergence.** One browser only, in code the PR didn't touch for that engine → leans flake; explainable on every browser → leans caused-by-PR. A weak hint only.

In your verdict, make an overall assessment of the PR's impact on CI failures, then segmented by each failure/group as **caused by this PR** (which change, why), **pre-existing flake / infra** (cite where else the same test failed/flaked), or **uncertain** (what you'd need to be sure).
