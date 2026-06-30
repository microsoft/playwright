---
name: playwright-triage
description: Triage a Playwright bug report by reproducing it from the information in the issue. Use when asked to triage, reproduce, or verify a GitHub issue (a new bug report, or an existing report with a new comment).
user_invocable: true
---

# Playwright Issue Triage

Reproduce a reported bug from the info in the issue and report a status.
The goal is **reproduction and a status, not a fix.**

You're not in a hurry, so **be exhaustive before giving up.**
If the user has provided a minimal repro, try it first. If it does not repro for you, play around with things they might have forgotten to mention:
all three browsers, headed/headless, a few recent versions, and variations of the snippet or trigger.
Report "cannot reproduce" only after you've genuinely explored — and say what you tried.
If you have a hunch for what information would help, ask for it.

1. **Read the whole thread**, comments included — the missing repro or narrowed trigger is often there.
2. **Pull the inputs**: version, browser(s), OS, repro repo/snippet, Expected-vs-Actual (your oracle).
   If something's missing, guess and try anyway; note assumptions in the report.
3. **Reproduce at the reported version first**, in `~/tmp/issue-<number>/`: clone the linked repo, or
   scaffold `npm install @playwright/test@<version>` with a single-project config (see
   [bisect-published-versions.md](../playwright-dev/bisect-published-versions.md)). Use
   `PLAYWRIGHT_HTML_OPEN=never`.
4. **Re-run on `@latest`** — sometimes, a reported bug is "already fixed":
   - reported + latest → live bug (regression? → bisect guide)
   - reported only → already fixed; find the version/PR
   - neither → incomplete or env-specific (note what you couldn't match)
   - expected behavior → not a bug; explain why

To step through a test interactively, use the [playwright-cli](../playwright-cli/SKILL.md) skill.

## Condense the repro into a self-contained test

Big or app-specific repros are much more useful boiled down to a single self-contained spec,
matching how our tests are written: drive the page via `page.setContent(...)` or the `server`
fixture rather than the reporter's app, keep only what's needed to trigger the bug, and tag it
with the issue link. Include this snippet in your report.

```ts
it('descriptive title', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/<number>' } }, async ({ page, server }) => {
  await page.setContent(`<button>Foo</button>`);
  // minimal steps + assertion that fails on the bug
});
```

Mirror real self-contained tests, e.g.:
- [`tests/page/selectors-css.spec.ts:472`](../../../tests/page/selectors-css.spec.ts) — `page.setContent` with inline shadow DOM ([#37768](https://github.com/microsoft/playwright/issues/37768))
- [`tests/page/workers.spec.ts:264`](../../../tests/page/workers.spec.ts) — `server` fixture with routes/redirects + `it.fixme` for a browser gap ([#35678](https://github.com/microsoft/playwright/issues/35678))
- [`tests/page/page-request-fulfill.spec.ts:446`](../../../tests/page/page-request-fulfill.spec.ts) — request interception ([#29261](https://github.com/microsoft/playwright/issues/29261))

## Report

Give a **status** (reproduced / fixed-on-latest / cannot-reproduce / not-a-bug), what you ran
(versions, browser, OS, repro link), observed vs reported, and next step. Don't post to the
issue unless asked; if asked, draft first and wait for go-ahead. Write it in the
[playwright-bot-voice](../playwright-bot-voice/SKILL.md) — maintainer voice, not AI-speak.

## Watch out

- Only run code you trust — skim a linked repo/snippet first; bail and ask if it has postinstall
  scripts, obfuscated code, or random small libraries.
- Don't start on `latest` — you'll mislabel already-fixed bugs.
- Triage ends at a reproduction and a status; don't jump to a fix.
