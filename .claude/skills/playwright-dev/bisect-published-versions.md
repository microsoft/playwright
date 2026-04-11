# Bisecting a Regression Across Published Playwright Versions

When a user reports a regression between two published Playwright versions (e.g. "works in 1.58, broken in 1.59.1"), reproduce both side by side from npm — do **not** try to bisect against the monorepo source. Reading the compiled JS in `node_modules/playwright/lib/**` is faster and avoids build/branch confusion.

## Setup (two side-by-side installs)

Use `~/tmp/<version-tag>/` (NOT `/tmp/`) — the user's shell sessions live in `~/tmp`.

```bash
mkdir -p ~/tmp/<good>/tests ~/tmp/<bad>/tests

# Skip `npm init playwright@latest` — it's interactive and the scaffold
# pulls in 3 projects (chromium/firefox/webkit) which produces 6 test runs
# from a single spec and is confusing. Do this instead:
( cd ~/tmp/<good> && npm init -y && npm install @playwright/test@<good-ver> && npx playwright install chromium)
( cd ~/tmp/<bad>  && npm init -y && npm install @playwright/test@<bad-ver> && npx playwright install chromium )
```

Write a **minimal** `playwright.config.ts` with a single chromium project — the default scaffold's 3-project config will run the same spec 6 times and obscure output:

```ts
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```

Drop the repro spec (and any helper files) into both folders identically. Run:

```bash
( cd ~/tmp/<good> && npx playwright test )
( cd ~/tmp/<bad>  && npx playwright test )
```

Confirm the difference is real before investigating.

## Investigating the diff in node_modules

The compiled JS in `node_modules/playwright-core/lib/` and `node_modules/playwright/lib/` is the source of truth for what shipped.

In recent versions of Playwright these are bundled, so you can't compare
on per-file basis. You can extract files from bundles via grep though and compare.

Once you've found a candidate function, diff it across the two versions. Patches are usually 1–3 lines.

## Verifying the hypothesis

Edit the compiled JS in `~/tmp/<bad>/node_modules/playwright/lib/...` directly and re-run the test. No build step is needed — Node loads the JS as-is. Revert when done (or just delete the folder).

For stack-trace bugs in particular, a `console.log(new Error().stack)` inserted at the capture site (e.g. inside `expect.js`'s `captureRawStack`) instantly shows whether the issue is microtask-boundary related vs. a stack-filter regression vs. something else.

## Reporting

When the root cause is confirmed:

1. Quote the offending lines from `node_modules/.../lib/...` of the **bad** version, with file path.
2. Show the equivalent code from the **good** version for contrast.
3. Explain *why* the change breaks the user's case (don't just point at the diff).
4. Propose and verify a minimal fix by patching the bad install in place.

Post the writeup as a comment on the original issue with `gh issue comment <number> --repo microsoft/playwright --body "$(cat <<'EOF' ... EOF)"`.

## Pitfalls

- **Don't run `npm init playwright@latest`** — it's interactive and `--quiet` does not skip the prompts. `npm init -y` + `npm install @playwright/test@<ver>` is faster and deterministic.
- **Don't use the scaffold's default config** — the 3 browser projects multiply test runs by 3 and confuse the output. One chromium project is enough for 99% of repros.
- **Don't `cd` between commands in a single Bash call without `&&`** — the shell cwd resets between tool invocations.
- **`/tmp/` is not `~/tmp/`** — pick one and stay consistent. The user's interactive shells default to `~/tmp/`, so prefer that.
- **Don't `rm -rf` an existing `~/tmp/<ver>/`** without checking — it may be the user's prior work. Edit in place instead.
- **Don't try to map the bug to monorepo source first.** The shipped JS is what the user is running; source may have already been refactored or fixed on `main`. Investigate `node_modules/` first, then map the fix back to source only when proposing the upstream patch.
