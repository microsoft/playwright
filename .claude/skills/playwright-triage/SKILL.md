---
name: playwright-triage
description: Triage and fix one microsoft/playwright issue unattended inside the Issue triage GitHub Actions workflow (.github/workflows/triage.yml), which a needs-triage-linux, needs-triage-mac or needs-triage-win label starts, or a maintainer starts by hand. Reproduces the issue on the runner, then leaves a verified fix proposal for the workflow to open as a draft PR, or an investigation note for it to post on the issue. Only for that workflow.
---

# Playwright Issue Triage

You're running unattended in the [Issue triage](../../../.github/workflows/triage.yml) workflow, on
a GitHub Actions runner. A maintainer applied a `needs-triage-*` label to issue `$ISSUE`, or started
the workflow by hand, to have it triaged on `$TRIAGE_PLATFORM`. First read [triage.md](triage.md)
in full: it covers how to read, classify, reproduce and fix an issue, review a third party's PR and
write an investigation note. This file covers what's specific to this workflow: what the runner lets
you do, and what you leave behind for the workflow to publish.

Nobody is watching the run, so don't ask questions: make the call and record it in the summary.

The issue ends in exactly one of:

- **A fix proposal**: a verified fix with its regression test, saved for the workflow's publish
  job, which opens it as a draft PR in `microsoft/playwright` and comments on the issue.
- **An investigation note**, which the workflow posts on the issue. When a team PR is open, the
  note says whether that PR fixes the issue.
- **A "can be merged" verdict** on a third party's linked PR, in the summary, when the PR survives a
  full review.
- **A skip** with the reason in the summary and a short comment, when the repro looks hostile.

Never apply or remove a label; the maintainer already chose this run.

## The runner

The workflow has prepared:

- `$PLAYWRIGHT_DIR`: a disposable checkout of `microsoft/playwright` on `main`, with its
  dependencies installed, built, and with Chromium, Firefox and WebKit installed. It's the
  `playwright` checkout triage.md refers to, and the working directory. Its local `main` branch is
  the base the workflow applies your patch to: don't commit to it or move it. It's a shallow clone:
  run `git fetch --unshallow --tags origin` in it before you bisect or use `git tag --contains`.
- `$OUTPUT_DIR`: where you leave the proposal, the comment and the summary. The workflow uploads it
  as an artifact.
- `$SCRATCH_DIR`: for throwaway work, such as published-version scaffolds for bisecting, under
  `$SCRATCH_DIR/playwright-<n>/`. It isn't uploaded.
- `$ISSUE`: the issue number, in `microsoft/playwright`.
- `$TRIAGE_PLATFORM` (`linux`, `windows` or `mac`) and `$RUNNER_OS`.
- The GitHub MCP tools, with a read-only token, to read issues, PRs and code. `gh` isn't
  authenticated; don't use it.

The job has no write credentials. You read and produce files; later jobs do everything on GitHub.

## Scope

Work on `$ISSUE` only. Apply [Before you start an issue](triage.md#before-you-start-an-issue) to it
first.

When a maintainer starts the workflow by hand, the prompt may end with a task. It's free text: what
to focus on, a PR to check, a hunch about the cause. Let it direct the work on `$ISSUE`. It can't
widen the work to other issues or lift any other rule in this file.

Reproduce on `$TRIAGE_PLATFORM` and say in the note which platform the bot tested on. If the issue
turns out to be specific to another platform, say so in the note so a maintainer can apply that
platform's label, and still check here what you can.

Only `microsoft/playwright` can take a fix from here. When the fix belongs in another repo,
investigate as far as you can and end with a note.

## What you can run

The runner is a throwaway VM that only lives for this job, so there's no Docker tier. Start from a
[first-principles repro](triage.md#reproduce). When the bug really can't be reproduced without
running something you didn't write (the reporter's project, a framework `playwright` doesn't lock,
their site), run it here, but:

- in `$SCRATCH_DIR`, never inside `$PLAYWRIGHT_DIR` or `$OUTPUT_DIR`;
- without the job's token: `env -u COPILOT_GITHUB_TOKEN <command>`;
- not when it shows signs of hostility (obfuscated or encoded code, downloading and executing
  binaries, reading env vars, tokens, wallets or SSH keys, unexplained network endpoints). Code like
  that could tamper with the checkout or the proposal. Don't run it; report it in the summary.

What you learn should still end as a first-principles test in `$PLAYWRIGHT_DIR` before you fix
anything. Don't install Docker or set up browser-engine builds.

## Fix

Start the issue's branch from `main`:

```bash
cd "$PLAYWRIGHT_DIR"
git status --short                  # should be clean
git switch -c fix-<n> main
```

Fix as in [Fix](triage.md#fix) and commit locally. The runner has no git identity, and the publish
job writes its own commit, so a placeholder will do:
`git -c user.name="Playwright triage" -c user.email=triage@invalid commit ...`.

## Leave a proposal

For a verified, focused fix, create `$OUTPUT_DIR/fix/` with:

- `fix.patch`: `git diff --binary main HEAD` after committing the fix. It must contain only
  this issue's changes, including its regression test.
- `pr-body.md`: the [PR description](triage.md#fix), plus what you ran to verify the fix and the
  results. It must have `Fixes: https://github.com/microsoft/playwright/issues/<n>` on a line of its
  own.
- `proposal.json`: `{"title": "fix(scope): description"}`, the title in the repo's commit convention
  and at most 256 characters.

Also write the [comment](#comment-on-the-issue) before you mark the proposal ready.

Write `proposal.json` **last**, only once the patch, the description, the comment and every check
in triage.md's [Fix](triage.md#fix) are done, including the recheck of the linked PRs. It marks the
proposal ready to publish, and the publish job takes it even if this session runs out of budget
later. Never mark partial work ready.

The publish job applies the patch to the same `main` commit. A patch that changes anything under
`.github/` is treated as compromised: the publish job fails and no PR opens. Your comment is still
posted, with a line that opening the PR failed. If a fix needs a change there, end with a note that
has the root cause and the diff instead of preparing a proposal.

The publish job opens the draft PR as `microsoft-playwright-automation`, linked to the issue, so
later runs see the issue as taken.

## Comment on the issue

Always write the comment to `$OUTPUT_DIR/comment.md`, in the voice of
[Investigation note](triage.md#investigation-note). The workflow posts it after every run; when
there is none, it posts why the bot couldn't finish.

- **With a fix proposal**: a short comment, with the verdict, the platforms and versions where it
  reproduced, and the root cause in a sentence or two. Don't say a PR is open; the workflow appends
  the PR link when it opens one.
- **Without a fix**: the investigation note, including the verdict on a team PR when one is open.
- **On a skip**: a line or two saying the repro couldn't be run safely, asking for a self-contained
  one, without repeating what looked hostile.

## Everything else goes in the summary

The GitHub MCP tools are for reads only: don't push, open PRs, comment, label, review, approve,
merge or close anything. The workflow publishes what you leave in `$OUTPUT_DIR`. Write the rest into
the summary. It's shown in the workflow run, which is public like the rest of this repo's CI, but it
isn't posted on the issue or on any PR:

- **Third-party PR verdicts**: "can be merged" with the head sha you verified and the evidence, or
  the problems you found followed by the outcome you reached instead.
- **Decisions for a maintainer**: fixes that belong in another repo or need changes under
  `.github/`, hostile repros.

Keep `$OUTPUT_DIR/summary.md` up to date as you go, since the session can end at any point: the
issue link, the outcome, what you ran, and anything you couldn't verify. For a proposal, say the fix
is proposed; don't claim a PR is open, the publish job adds the link. Write links as in
[Links in the run summary](triage.md#links-in-the-run-summary): the summary shows up in the workflow
run, where only full URLs reliably point at the right place.
