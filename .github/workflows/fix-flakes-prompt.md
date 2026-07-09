# Playwright: Fix a Flaky or Red Test

Turn CI test-results data into **one** concrete fix: pick a high-impact flaky-or-red test that is reproducible on your OS,
confirm nobody's on it, fix the root cause *or* scope a skip, pick a reviewer, and hand off a
single commit that becomes the PR. Fully autonomous — no approval stops.

## 1. Pick one target

Query the DB following the patterns in `.claude/skills/playwright-test-results/SKILL.md`.
Two families:

- **Cross-run flake** — the *final* verdict (after retries) flips between runs.
- **Consistent red** — `expected_status = 'passed'` yet failing in ~every run.

Rank by **impact**: fail %, run count (floor `runs >= 10` so it isn't a one-off), and how many
bots/PRs it disrupts — **not** by "has a tidy error message".
Pick a candidate whose failing `bot_name` OS matches yours so you can reproduce it.
Keep the ranked list — you fall back down it in step 2. Say why you picked the top one.

## 2. Check nobody's on it — and that it isn't already fixed

Two dead ends to rule out before touching a candidate. If either fires, drop it and go
down your step-1 ranking, re-checking each; only stop once the whole shortlist is covered.

- **Already being worked on** — search PRs/issues (open *and* recently merged/closed) for
  the test title words and file path, plus any issue linked in the test's `annotation`.
- **Already fixed** — the DB is a rolling window that still holds the failing runs from
  before a fix landed, so a test fixed mid-window looks maximally bimodal (old fails + new
  passes), which is exactly what floats it up step 1. Check whether a fix has landed since it
  last flaked: find the commit its most recent failing run ran on, and look at what's changed
  in that test's file since. A commit that plausibly targets the test or its feature — a
  browser roll, or a fix to the test or the code it exercises — means the remaining DB fails
  are from before the fix, so move on.

## 3. Reproduce on this OS

Read the test and its `error_message`.

Build first (`npm run build`; watch is **not** running — if you touch generated-code files see
`CLAUDE.md`). Then reproduce, scoped to the failing target.

The DB `project_name` **is** the Playwright `--project`; `bot_name` encodes the OS. **Always
pass a `<file>:<line>` filter** — a bare run launches the whole suite. The browser test scripts
are project-locked, so use the one matching the failing bot:

| Failing target | Command |
|---|---|
| chromium | `npm run ctest -- <file>:<line>` |
| firefox | `npm run ftest -- <file>:<line>` |
| webkit | `npm run wtest -- <file>:<line>` |
| `tests/playwright-test/**` | `npm run ttest -- <file>:<line>` |
| `tests/mcp/**` | `npm run test-mcp -- --project=<name> <file>:<line>` |

Other suites (electron `etest`, etc.): see `package.json` scripts.
Add `--repeat-each=N` to force a flake's flip.

**You can only reproduce what this OS reaches.** A failure you can't reach here is itself
evidence it's environment-specific — a skip candidate (step 6), not a blind-fix.
Keep any OS handling keyed on the *current* OS, never hardcoded.
Broader OS coverage comes from different agent runs on other OSes, not from you.

## 4. Fix — root cause or scoped skip

- **Tractable → fix the source.** Usually a test-side race: a missing `await`, waiting on the
  wrong signal, an under-specified locator, leaked state. Fix the test (or the product bug).
- **Engine/OS-specific, unreachable here, or genuinely hard → scope a skip**, narrowed to the
  exact failing condition — never a whole file or browser:

  ```ts
  it.fixme(browserName === 'webkit' && isLinux, 'https://github.com/microsoft/playwright/issues/NNNNN');
  ```

  Link an issue if one exists or explain why the test is skipped. **Default to `fixme`** — it parks
  the debt and stays greppable. Use `skip` only if reproduction shows the test is genuinely
  mis-scoped for that config (`skip` claims "this failure is expected and correct," which a
  flake-fighter rarely is). Never `skip` just to turn a red green.

**Verify locally — your PR gets no CI (step 6), so this is the only proof:** flake → re-run with
`--repeat-each` and confirm it's stable; skip → confirm it's skipped on the target config and
**still runs elsewhere**. Then run `npm run flint`. Record exactly what you ran — it goes in the
PR body.

## 5. Pick a reviewer

No CODEOWNERS. Derive one from the touched file(s) — recent authors and frequent committers:

```bash
git log --format='%an %ae' -n 20 -- <file>
git log --format='%an' -n 200 -- <file> | sort | uniq -c | sort -rn
```

Also skim recent merged PRs on those paths for who reviewed them. Pick someone with real recency
+ ownership. Record it as a git trailer so it survives the handoff:

```
Suggested-reviewer: dgozman
```

## 6. Commit and hand off (you never open the PR in CI)

You **never push or open a PR** in CI or locally. The harness does that for you, after you commit.

- **Exactly one commit** on the current branch (`CLAUDE.md` conventions; no
  co-author / "generated with" trailers; never amend).
- **The commit message _is_ the PR** — the harness runs `gh pr create --fill`, mapping
  subject→title and body→description. Write both in the Playwright bot voice
  (`.github/workflows/bot-voice.md`) — verdict first, short, no slop. The
  body must carry: the **DB evidence** (fail %, runs, bots) + any related issue; **what you
  verified locally** and on which OS.
- **Nothing actionable?** Make no commit — the harness then skips the PR.

Report what you committed, the reviewer, and why.

## Guardrails

- **One target, one commit.** Don't batch.
- **Scoped skips only** — narrow to the failing condition, never a whole file or browser matrix.
- **No unverified PRs** — if you couldn't run it locally, prefer a documented fixme.
