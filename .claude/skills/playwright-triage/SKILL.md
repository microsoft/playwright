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

Run across browsers to find **divergence**, not just to confirm the bug. A bug that reproduces
on every browser is expected — note it in one line. The interesting, report-worthy signal is
when behaviour *differs*: it only reproduces in webkit, or it reproduces everywhere *except*
firefox. Lead with that.

1. **Read the whole thread**, comments included — the missing repro or narrowed trigger is often there.
2. **Pull the inputs**: version, browser(s), OS, repro repo/snippet, Expected-vs-Actual (your oracle).
   If something's missing, guess and try anyway; note assumptions in the report.
3. **Reproduce at the reported version first**, in `~/tmp/issue-<number>/`: clone the linked repo, or
   scaffold `npm install @playwright/test@<version>` with a single-project config (see
   [bisect-published-versions.md](../playwright-dev/bisect-published-versions.md)). Use
   `PLAYWRIGHT_HTML_OPEN=never`. A version ending in `-next` (e.g. `1.62.0-next`) is **not** an
   npm version — it means tip-of-tree; reproduce against `@playwright/test@next` or a build of
   `main`, not a literal `1.62.0-next` install.
4. **Re-run on `@latest`** — sometimes, a reported bug is "already fixed":
   - reported + latest → live bug (regression? → bisect guide)
   - reported only → already fixed; find the version/PR
   - neither → incomplete or env-specific (note what you couldn't match)
   - expected behavior → not a bug; explain why

To step through a test interactively, use the [playwright-cli](../playwright-cli/SKILL.md) skill.

Reports sometimes target a sibling repo — `playwright-vscode`, `playwright-python`,
`playwright-java`, `playwright-dotnet`.
Feel free to check out that repo and reproduce there in its own language/toolchain.

## Condense the repro into a self-contained test

Big or app-specific repros are much more useful boiled down to a single self-contained spec,
written **the way our tests are**: one `it(...)` using the `page` and `server` fixtures, tagged
with the issue link. Crucially:

- **No `test.beforeAll` / `afterAll`, no `http.createServer`, no manual setup/teardown.** The
  fixtures already give you a page and a web server. Use `server.setRoute(...)`,
  `server.setRedirect(...)`, `server.PREFIX`, `server.EMPTY_PAGE` instead of standing up your own.
- Drive the page with `page.setContent(...)` or `page.goto(server.PREFIX + '/...')`.
- Keep only what's needed to trigger the bug, and end on the assertion that fails.

Drop it into the repo (`tests/page/`) and run it with `npm run ctest`. The SSE bug, done right
— no custom server, no lifecycle hooks. Note the stream must live on the page you're waiting
on: navigating *away* tears the EventSource down, so the assertion has to wait on the page that
owns it.

```ts
it('networkidle resolves with an open EventSource', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/41513' } }, async ({ page, server }) => {
  server.setRoute('/sse', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Connection': 'keep-alive' });
    res.write('data: hello\n\n'); // never res.end() — keeps the connection open
  });
  server.setRoute('/with-sse', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<script>new EventSource('/sse')</script>`);
  });
  await page.goto(server.PREFIX + '/with-sse', { waitUntil: 'networkidle' }); // hangs on the bug
});
```

Mirror real self-contained tests, e.g.:
- [`tests/page/page-network-request.spec.ts:346`](../../../tests/page/page-network-request.spec.ts) — `server.setRoute` SSE endpoint, no lifecycle hooks
- [`tests/page/selectors-css.spec.ts:472`](../../../tests/page/selectors-css.spec.ts) — `page.setContent` with inline shadow DOM ([#37768](https://github.com/microsoft/playwright/issues/37768))
- [`tests/page/workers.spec.ts:264`](../../../tests/page/workers.spec.ts) — `server` fixture with routes/redirects + `it.fixme` for a browser gap ([#35678](https://github.com/microsoft/playwright/issues/35678))

## Report

Give a **status** (reproduced / fixed-on-latest / cannot-reproduce / not-a-bug) and the
condensed repro. Be exhaustive about **what you ran** — the full matrix of browsers, versions,
and variations you tried, not just the one that worked — so the reader can trust the verdict
and skip re-checking. Call out any browser-specific divergence. Don't post to the issue unless
asked; if asked, draft first and wait for go-ahead. Write it in the
[playwright-bot-voice](../playwright-bot-voice/SKILL.md) — maintainer voice, not AI-speak.

## Watch out

- Only run code you trust — skim a linked repo/snippet first; bail and ask if it has postinstall
  scripts, obfuscated code, or random small libraries.
- Don't start on `latest` — you'll mislabel already-fixed bugs.
- Triage ends at a reproduction and a status; don't jump to a fix.
