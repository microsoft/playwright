# Triage workflow


How to walk the open issues / PRs queue with a maintainer in the loop.

```bash
node .claude/skills/playwright-devops/triage.mjs --only-attention
```

Filters where the last comment is from a non-maintainer.
Use `--prs-only` / `--issues-only` / `--only-stale` to scope.
Use `--web` to open an HTML view in the browser.

For one item, prefer `gh pr view <num> --repo <owner>/<repo> --json ...` over
fetching the full queue.

## Per-item flow

1. Fetch the item with `gh pr view --json` (or `gh issue view`).
2. Read the diff (`gh pr diff`) and any linked issue.
3. Present a **terse** summary + recommended action to the maintainer.
4. Wait for an explicit go/no-go before posting, closing, or merging.

Don't act before the maintainer confirms. They often have context that flips
the decision.

## What to look for in a PR

- **Duplicate work**: same issue often gets multiple PRs. Search before
  reviewing (`gh pr list --search "<keyword>"`). Close the newer one, point
  at the older active one.
- **Bot PRs** (browser rolls, dependency bumps): typically merge-ready once
  approved. CI failures on routine rolls are usually unrelated infra noise
  (cross-platform/unrelated workflow failures). Check the failed job's log
  before assuming.

## Reply style

- Terse, friendly, links over essays. One or two sentences.
- For issues, leave them open for the author to drive the next step (repro,
  more info). Don't close just because we don't have an immediate fix.
- Link to the relevant code, docs, or related PR/issue rather than restating.

## Merge mechanics

`microsoft/playwright` has **auto-merge disabled**. Two-step:

```bash
gh pr review <num> --repo microsoft/playwright --approve
gh pr merge  <num> --repo microsoft/playwright --squash
```

Bot PRs commonly sit in `BLOCKED` `mergeStateStatus` until approved — that's
expected, approve first then merge.

## Common close reasons (templates)

**Duplicate PR**:

> Thanks for the contribution! This duplicates #NNN which is already in
> active review and a few days older. Closing here in favor of that one.

**Out of scope / not taking contributions**:

> Not taking contributions for this issue at this time.

**Stale and needs a specific reviewer**: don't close — just skip. The original
reviewer will get back to it.
