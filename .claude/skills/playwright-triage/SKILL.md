---
name: playwright-triage
description: Triage a Playwright bug report by reproducing it from the information in the issue. Use when asked to triage, reproduce, or verify a GitHub issue (a new bug report, or an existing report with a new comment).
user_invocable: true
---

# Playwright Issue Triage

Triage a GitHub issue by working out what it actually is, then doing the right thing for that kind.
The goal is **a clear, verified status, not a fix.**

## First, classify the issue

Judge by the content, not the label — a "[Feature]" is often really a bug (something already
*should* work), and a "[Bug]" is sometimes expected behaviour. Work out what it actually is:

- **Bug** — reproduce it. The bulk of this skill.
- **Feature request** — nothing to reproduce. Check it doesn't already exist (search docs/API,
  maybe under another name), verify any source the reporter cites by reading it, and surface the
  real design question. If it's small and well-scoped (like "fail loudly instead of
  silently"), the ideal takeaway is an **acceptance test**: one self-contained spec asserting
  *current* behaviour (passes today) with the *desired* behaviour alongside as a `fixme`/commented
  assertion.
- **Upstream / environment** — a genuinely external owner (the Node project, a browser engine, a
  website's own server/cert config), not Playwright. Find the real owner, don't brute-force a repro,
  verify any cited upstream issue and point at the real fix path. Note: the Playwright **family** —
  `@playwright/mcp` (source lives here under `packages/playwright-core/src/tools/mcp/`),
  `playwright-vscode`, `-python`, `-java`, `-dotnet` — is **not** "upstream"; it's us. Never tell a
  reporter to refile within the project (see below).
- **Question / usage** — answer it or point at the docs.

The rest of this skill is the **bug** path.

## Reproducing a bug

You're not in a hurry, so **be exhaustive before giving up.**
If the user has provided a minimal repro, try it first. If it does not repro for you, play around with things they might have forgotten to mention:
all three browsers, headed/headless, a few recent versions, and variations of the snippet or trigger.
Report "cannot reproduce" only after you've genuinely explored — and say what you tried.
If you have a hunch for what information would help, ask for it.

Run across browsers, and watch for **divergence** — a bug that only reproduces in webkit, or
everywhere *except* firefox, is a strong signal worth leading with. Plenty of bugs are
browser-agnostic, though, and those are just as real: reproducing on every browser is a good
result to report, not a non-finding.

1. **Read the whole thread**, comments included — the missing repro or narrowed trigger is often there.
2. **Pull the inputs**: version, browser(s), OS, repro repo/snippet, Expected-vs-Actual (your oracle).
   If something's missing, guess and try anyway; note assumptions in the report.
3. **Reproduce on tip-of-tree first**, in `~/tmp/issue-<number>/`: clone the linked repo, or
   scaffold `npm install @playwright/test@next` with a single-project config (see
   [bisect-published-versions.md](../playwright-dev/bisect-published-versions.md)). Use
   `PLAYWRIGHT_HTML_OPEN=never`. If it reproduces on ToT, it's a **live bug** — record the exact
   version/sha you tested, and if it looks like a regression, bisect it (see the guide).
4. **If ToT doesn't reproduce it**, try the version the user reported. If it reproduces there but
   not on ToT, it's **already fixed** — find the version/PR that fixed it (a cherry-pick may still
   be worth it). If neither reproduces, it's incomplete or env-specific — say what you couldn't
   match. (A version ending in `-next`, e.g. `1.62.0-next`, is **not** an npm version — it means
   tip-of-tree, which is the `@next` build you already tried.)

To step through a test interactively, use the [playwright-cli](../playwright-cli/SKILL.md) skill.

Reports sometimes target another part of the Playwright project — `@playwright/mcp` (its source is
in this repo), `playwright-vscode`, `playwright-python`, `playwright-java`, `playwright-dotnet`.
These are all **us**, so triage them like anything else: check out that repo and reproduce there in
its own language/toolchain when needed. **Never** tell the reporter the issue belongs in a different
Playwright repo or should be refiled there — that's an internal routing detail, not the reporter's
problem.

## Condense the repro into a self-contained test

Big or app-specific repros are much more useful boiled down to a single self-contained spec,
written **the way our tests are**: one `test(...)` using the `page` and `server` fixtures, tagged
with the issue link. Crucially:

- **No `test.beforeAll` / `afterAll`, no `http.createServer`, no manual setup/teardown.** The
  fixtures already give you a page and a web server. Use `server.setRoute(...)`,
  `server.setRedirect(...)`, `server.PREFIX`, `server.EMPTY_PAGE` instead of standing up your own.
- Drive the page with `page.setContent(...)` or `page.goto(server.PREFIX + '/...')`.
- Keep only what's needed to trigger the bug, and end on the assertion that fails.

Drop it into the repo (`tests/page/`) and run it with `npm run ctest`.

Mirror real self-contained tests, e.g.:
- [`tests/page/page-network-request.spec.ts`](../../../tests/page/page-network-request.spec.ts) — `should return event source`: `server.setRoute` SSE endpoint, no lifecycle hooks
- [`tests/page/selectors-css.spec.ts`](../../../tests/page/selectors-css.spec.ts) — `should use light DOM structure for child combinator with slotted content`: `page.setContent` with inline shadow DOM ([#37768](https://github.com/microsoft/playwright/issues/37768))
- [`tests/page/workers.spec.ts`](../../../tests/page/workers.spec.ts) — `should report worker script as network request after redirect`: `server` fixture with routes/redirects + a browser-gap `fixme` ([#35678](https://github.com/microsoft/playwright/issues/35678))

## Report

Give a **status** that fits the issue type — for a bug: reproduced / fixed-on-latest /
cannot-reproduce / not-a-bug; for a feature request or upstream/env issue: a short verdict
(already-possible, valid request, upstream — owned by X) — plus the evidence. For bugs, include
the condensed repro and be exhaustive about **what you ran** — the full matrix of browsers,
versions, and variations you tried, not just the one that worked — so the reader can trust the
verdict and skip re-checking. Call out any browser-specific divergence. Write it in the
[playwright-bot-voice](../playwright-bot-voice/SKILL.md) — maintainer voice, not AI-speak.

## Watch out

- Only run code you trust — skim a linked repo/snippet first; bail and report that in the issue
  comment if it has postinstall scripts, obfuscated code, or random small libraries.
- Triage ends at a reproduction and a status; don't jump to a fix.
