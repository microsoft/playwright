---
name: playwright-audit-deps
description: Roll the runtime dependencies that npm audit flags with a moderate or higher advisory to safe versions that are at least 8 days old, and commit them with a table of every package the lock file change touched (old and new version, publish date, weekly downloads). Use when asked to fix audit findings, bump vulnerable or outdated runtime dependencies, or update package-lock.json for an advisory.
user_invocable: true
---

# Roll runtime dependencies flagged by npm audit

`/playwright-audit-deps [issue url]`

A runtime dependency is a package whose code ends up in a published Playwright package: it is
inlined into a bundle (listed in a `packages/*/lib/**/*.js.txt` sidecar) or named in the
`dependencies` of a `packages/*/package.json`. Advisories on dev-only packages, such as eslint
plugins or chromium-bidi, are reported as skipped and left alone.

A version is eligible when it is outside every advisory range, was published at least 8 days
ago, and is accepted by every runtime dependent in `package-lock.json`. The newest eligible
version wins. Packages that `npm install` pulls in beyond that age are pinned back the same way.

The lint `npm run check-dependency-age` (part of `npm run lint` and `npm run flint`, so CI
runs it on every PR) fails when any version in `package-lock.json` is less than 7 days old.
The 8-day default here keeps a one-day margin above that limit.

## Steps

1. Start from a clean checkout of `main` with `npm run build` done, so the bundle sidecars
   exist. Create the branch: `fix-<issue number>` when an issue is given, else `bump-runtime-deps`.

2. Plan: `node .claude/skills/playwright-audit-deps/audit-deps.mjs`. It prints, per runtime
   advisory, the version it would roll to, or why it cannot (no fixed version, fixed version too
   new, a runtime dependent rejects it, or a major bump of a package pinned in `package.json`).

3. Apply: `node .claude/skills/playwright-audit-deps/audit-deps.mjs --apply --report=<scratchpad>/deps-report.md`.
   Pass `--allow-major` only when the user asked for a major bump; otherwise leave those
   packages in the "Not rolled" list and tell the user. Options: `--max-age-days=N` (default 8),
   `--severity=low|moderate|high|critical` (default moderate), `--base=<ref>` for the report diff.

4. Verify: `npm run build`, then `npm run itest tests/installation/bundle-licenses.spec.ts tests/installation/bundle-size.spec.ts`
   and `npm run check-dependency-age`. A new dependency without a `repository` field, a bigger
   bundle, or a version younger than 7 days fails here. Fix the cause or drop that roll, then
   rerun the report.

5. Commit `package.json` and `package-lock.json` as one commit:

   ```
   chore(deps): bump runtime deps

   <the markdown table and the "Not rolled" list from the report>

   Fixes: <issue url, when given>
   ```

6. Report the table and the not-rolled packages to the user. **Never push.** When told to open
   the PR, use the same title and a body of one bullet naming the packages rolled for an
   advisory, the table, and the `Fixes` line.

## Notes

- `npm audit` lists a package that only depends on a vulnerable one (chromium-bidi via zod)
  as its own finding; the script follows the actual advisory, so such entries are not acted on.
- A root-pinned package is bumped with `npm install <name>@<version> --save-exact`. Any other
  package is rewritten in place in `package-lock.json` and reconciled with `npm install`. The
  script fails if `npm ls` reports a problem afterwards.
- Run the apply step once from the clean base; a second run labels the already rolled packages
  as plain dependencies in the "Reason" column, because the audit no longer flags them.
