---
name: api-review
description: Produce the "Playwright 1.xx API Review" artifact for a range of commits - the public API additions and the breaking or behavior changes that affect existing users since the last API review or since the last release, ordered by impact, each with links, before/after snippets and a documentation check. Covers microsoft/playwright (Node.js) and the Python, Java and .NET ports. Use when asked for an API review, to review API changes, or to check what changed in the public API since a release or since the last review.
user_invocable: true
---

# API review

`/api-review [python|java|dotnet] [range]`

Without a language, review microsoft/playwright (the Node.js package, the test runner, MCP and the CLI).
With a language, review that port: see "Language ports" at the end, which changes the range, the
sources and the composition; everything else applies as written.

Produce one artifact (an HTML page published with the Artifact tool) that a maintainer reads before a
release. It lists the changes in the range that **change the public API or affect existing users**,
ordered by impact, and checks that each one is documented. The reviewer types feedback into the page
and copies a GitHub issue draft from it.

The review is not a changelog. A change is in because a user has to learn a new API, or because an
existing test suite may start behaving differently. A fix that makes Playwright more correct in a
corner case is not in, even though some user somewhere will notice it.

Work in the current checkout only. Do not commit anything.

## 1. Choose the range

In order of preference:

1. **Explicit range** from the argument, for example `v1.64.0..main` or `abc1234..main`.
2. **Since the last API review.** List the user's artifacts (`Artifact` tool, `action: "list"`) and
   take the newest one titled `Playwright 1.xx API Review`. Read it; the `.meta` line records
   `Range: <base>..main (<n> commits, head <sha>)`. The new range is `<sha>..main`. Use this when the
   user says "since the last review" or when a review for the current version already exists.
3. **Since the last release.** `git fetch --tags`, then the newest `v1.xx.0` tag
   (`git tag --sort=-creatordate | grep -v beta | head`). The range is `v1.xx.0..main`.
   Point releases cherry-pick from main: list `git log --oneline v1.xx.0..v1.xx.y` and exclude those
   PR numbers, since they are already released. Say so in the `.meta` line.

Read the version under review from `package.json` (`1.65.0-next` means `1.65`).

## 2. Collect candidates

Run these and keep a list of candidate commits with their PR numbers. Run independent commands in parallel.

- `git log --oneline --no-merges <range>`, dropping `chore(deps`, browser rolls, `devops(`, and
  `test(` commits. Everything else is a candidate until it is ruled out.
- `grep -rn -B3 "since: v1.xx" docs/src/` for new API entries.
- `git diff --stat <range> -- docs/src` and then the content diff of `docs/src/test-api`,
  `docs/src/test-reporter-api`, the changed guides (`docs/src/*-js.md`, `docs/src/*.md`) and the
  changed `docs/src/api/class-*.md`. Filter out type-rendering noise (lines that start with
  `- type:` or `` - `name` ``) to find real text changes.
- Public types: `git diff <range> -- packages/playwright/types/test.d.ts
  packages/playwright/types/testReporter.d.ts packages/playwright-core/types/types.d.ts`, keeping
  only non-comment added or removed lines.
- CLI and MCP options: diff of `packages/playwright/src/program.ts`,
  `packages/playwright-core/src/tools/cli-daemon/commands.ts`,
  `packages/playwright-core/src/tools/mcp/program.ts` and `packages/playwright-core/src/tools/mcp/config.d.ts`.
- Environment variables: grep the range diff for added `process.env.PLAYWRIGHT_` and `PW_` names.
- Reverts: a `Revert "..."` commit of a change that shipped in the last release is a breaking change
  against that release. Check with `git merge-base --is-ancestor <original sha> v1.xx.0`.

For each candidate, get the PR body and linked issues in one loop:
`gh pr view <n> --repo microsoft/playwright --json title,body,closingIssuesReferences`. Squashed
commit messages have no bodies; the PR body is where the rationale and the issue links are. Then
`git show --stat <sha> -- docs` tells which docs the PR touched.

## 3. Decide what is in

Two questions decide it. Does the change add, remove or rename something in the public API? Does it
change what existing user tests do, broadly enough that a maintainer would list it under "Breaking
Changes" in the release notes? One yes is enough. Two noes and the change is out, however visible.

**Include:**

- New public API: classes, methods, options, events, test and config options, fixtures, reporters
  and reporter options, CLI flags and commands, documented environment variables, MCP tools, tool
  parameters, MCP config and flags, `playwright-cli` commands and options.
- Breaking changes: functionality removed or renamed, defaults changed, a documented behavior changed
  so that existing user tests can fail or pass differently. Reverts of behavior that shipped in the
  last release count, even when the revert restores older behavior.
- Behavior changes that are not bug fixes: a stricter check, a new exit code, a new wait, a changed
  output location or format that other tools read.
- A bug fix only when it clears the impact bar: a common pattern in existing tests changes outcome,
  for example a passing action now waits and times out, a throwing action now succeeds, or a CI run
  exits with a different code. Corrections in corner cases do not clear the bar, even when they
  change observable behavior: cookie matching rules for subdomains, which credentials answer which
  auth challenge, encoding details, internal browser implementation swaps with an escape hatch.

**Exclude**, and list in "Examined and not included" with the reason:

- Bug fixes that restore documented or intended behavior, including regression fixes and fixes that
  align one browser with the others, and bug fixes that do not clear the impact bar above.
- Changes added and removed within the same range.
- Protocol or `LocalUtils` additions that only language ports use; note which port must act.
- Internal removals that were never in the previous release's public types or docs. Check with
  `git show v1.xx.0:packages/playwright/types/testReporter.d.ts | grep <name>`.
- Docs-only commits, refactors, test infrastructure. Mention a docs-only commit only when it changes
  `since:` markers for other languages.

When unsure, ask: would a typical existing test suite notice, and would a user need to change code
or config? If yes to either, include it as "Behavior". If the honest answer is "only a test that
depends on this exact edge case", exclude it and name it in "Examined and not included". Security
hardening with no API surface is excluded. Prefer a shorter review with every item worth a decision
over a complete one.

## 3a. Order by impact

Items are ordered by impact, most impactful first, in the summary table and on the page. No grouping
by area. Use these tiers, then order within a tier by how many users hit it: library and test runner
before MCP and CLI, changes that happen without opting in before opt-in features.

1. Breaking changes users meet at runtime with no compiler or lint hint: removed or renamed API,
   changed defaults, actionability or locator semantics that change which elements match or whether
   an action proceeds.
2. Behavior shipped in the last release that is reverted or changed again, and behavior changes that
   change a CI exit code or a report's contents.
3. Other behavior changes that can flip a test from failing to passing or the reverse.
4. New API most users will adopt: test runner options, library methods and options.
5. New options and flags with a narrow audience: CLI flags, MCP config, environment variables.

A bug fix that clears the impact bar sits in tier 2 or 3, never above a breaking change.

## 4. Check the documentation

For each included item, find the pages on `https://playwright.dev/docs/next/`:

| Source | URL |
|---|---|
| `docs/src/<page>-js.md`, `docs/src/<page>.md` | `/docs/next/<page>` |
| `docs/src/api/class-<x>.md` | `/docs/next/api/class-<x>#<class>-<method>` (kebab-case, options as `#<class>-<method>-option-<name>`) |
| `docs/src/test-api/class-<x>.md`, `docs/src/test-reporter-api/class-<x>.md` | `/docs/next/api/class-<x>` |
| `docs/src/getting-started-cli.md`, `packages/playwright-core/src/tools/skills/playwright-cli/` | `/docs/next/getting-started-cli`, the CLI skill reference |
| MCP flags, tools and config | README in `microsoft/playwright-mcp`, regenerated at release by `update-readme.js`; fetch it with `gh api repos/microsoft/playwright-mcp/contents/README.md --jq .content \| base64 -d` and `config.d.ts` doc comments |

Grep the docs for the new name. Heading anchors come from `## method:` and `### option:` lines and from
guide headings (`### Report only failures` is `#report-only-failures`).

Also check `docs/src/release-notes-js.md`: if there is no `## Version 1.xx` section yet, say so in the
note at the top and mark every Breaking and Behavior item as needing a release-notes line.

Docs status vocabulary, one badge per item:

| Badge | Class | Meaning |
|---|---|---|
| OK | `b-ok` | Reference and guide cover the change |
| Partial | `b-partial` | Covered in one place, missing in another that users will read |
| Needs notes | `b-partial` | Docs are fine, the release notes must flag it (breaking) |
| README stale | `b-partial` | Documented in `config.d.ts` or tool schema, README regenerates at release |
| None | `b-partial` | Nothing documented and nothing needed |
| Internal | `b-partial` | Deliberately undocumented escape hatch |
| Missing | `b-missing` | Users will look for it and not find it |

The "Docs status" sentence becomes the `- [ ] Docs:` task in the issue draft for every badge except
OK and None, so write it as an instruction: what to add and on which page.

## 5. Write the page

Copy `template.html` from this skill's directory into the scratchpad as `api-review-1.xx.html` and fill
it. Keep the CSS, the class names and the script unchanged: the issue-draft generator reads
`header .num`, `h3`, the `Links` and `Docs status` fields and the feedback textarea of each
`section.card`.

- Replace every `{{PLACEHOLDER}}`. Delete the sample card, sample rows and sample excluded entry.
- Order items by impact (step 3a). Number them `c1`, `c2`, ... in that order; the summary table has
  the same order and links to them, and the numbers must match. The `Area` column in the table
  (Library, Test runner, MCP, CLI) replaces grouping.
- Keep the MCP README note under the "Changes" heading only when the review has MCP or CLI items.
- Kind badges: `New API`, `New option` (`b-new`); `Breaking`, `Breaking vs 1.xx` (`b-breaking`);
  `Behavior` (`b-behavior`). An item can carry two.
- Description: two to five sentences in plain language. Name the escape hatch if there is one. Note
  when the PR title and the shipped name differ.
- Links: PR, linked issues, the original and revert PRs for relands and reverts, earlier attempts
  when the PR lists them. Issues in other repos (`playwright-mcp`, `playwright-cli`, `playwright-java`)
  are linked with the repo name.
- Before and after: real test, config or CLI snippets, three to eight lines each. Omit "Before" when
  there was no way to do it before; keep "After". For a behavior change, show the same code with the
  old and new outcome as a comment.
- Only state what you verified. Check which browsers a change touched with `git show --stat` before
  naming them. Do not quote a version number you did not look up.
- Escape `<`, `>` and `&` as `&lt;`, `&gt;` and `&amp;` in every snippet, title and description.
  Snippets often contain HTML such as `<button>` or `<dialog>`; unescaped, the browser renders it as
  real elements inside the page. After writing the file, check with
  `grep -n '<pre><code>' <file> | grep -v '&lt;'` and read the `<pre>` blocks for raw tags.

Put the one-line summary of the whole review in the top `.note`: release notes state, which items
need a breaking callout.

## 6. Publish and report

Publish with the Artifact tool (first publish: `icon: "review"`, a one-sentence `description`).
A later review for the same version is a new artifact; do not overwrite the previous one, the
reviewer's feedback lives in their browser against that page.

In the reply, give the link, the range, how many items, and the two or three items that need a
decision (breaking changes, reverts of shipped behavior, missing docs). Do not repeat the page.

## Language ports: Python, Java and .NET

A port review covers two streams: the port's own repository, and the core changes that reach the
port through its driver. The port repositories are not checked out; read them with `gh`.

| Port | Repository | Package docs | Release notes | Driver pin |
|---|---|---|---|---|
| Python | `microsoft/playwright-python` | `https://playwright.dev/python/docs/` | `docs/src/release-notes-python.md` | `DRIVER_VERSION` (a microsoft/playwright commit) |
| Java | `microsoft/playwright-java` | `https://playwright.dev/java/docs/` | `docs/src/release-notes-java.md` | search the repo for the driver version file |
| .NET | `microsoft/playwright-dotnet` | `https://playwright.dev/dotnet/docs/` | `docs/src/release-notes-csharp.md` | search the repo for the driver version file |

**Range.** Tags are `v1.xx.y` in every port. "Since the last release" is `v1.xx.0...main` in the
port repository; exclude the commits of `v1.xx.0...v1.xx.y` point releases. "Since the last review"
reads the head from the previous port review artifact, as for core. The driver stream is the core
range from the driver commit the port shipped with to the driver commit at the port's head; the roll
PRs (`chore: roll Playwright to ...`) name both commits. State both ranges in the `.meta` line.

```bash
gh api repos/microsoft/playwright-python/tags --jq '.[0:6][].name'
gh api "repos/microsoft/playwright-python/compare/v1.xx.0...main" --paginate \
  --jq '.commits[] | .sha[0:9] + " " + (.commit.message | split("\n")[0])'
gh pr view <n> --repo microsoft/playwright-python --json title,body,closingIssuesReferences
gh api -H "Accept: application/vnd.github.raw" "repos/microsoft/playwright-python/contents/<path>?ref=<tag or main>"
```

**Port stream.** Candidates are the port's own PRs: fixes to the generated API (`fix(assertions): ...`),
packaging and distribution (wheels, sdist, Maven artifacts, NuGet packages, bundled Node.js),
supported runtimes (`requires-python` and classifiers in `pyproject.toml`, Java versions in `pom.xml`,
target frameworks in the `.csproj`), dependencies, client rewrites and error messages. Compare the
build files and the README between the two tags with the raw contents API. A client rewrite is in even
when the public API is unchanged: say what private module paths and observable behaviors changed,
since users import private modules. Roll PRs are not items themselves, but their bodies say whether
"API comparison" produced changes and list the upstream commits; read them.

**Driver stream.** Take the library items from the core review of the same version when one exists
(link its artifact) and keep only those that apply to the port: entries whose docs carry `* langs: js`
are out, entries with no `langs` line or with the port's language are in. The test runner, UI mode,
the HTML report, MCP and `playwright-cli` do not ship with the ports; leave them out and say so in the
excluded list. Verify that the port's generated API has the new member before listing it as new API:
grep the port's generated source, for example `playwright/sync_api/_generated.py` for Python, because
a roll can lag the docs. Write the snippets in the port's language and link the port's docs pages.
When no core review exists for the version, run steps 2 to 4 on the core range of the driver stream
first.

**Docs for a port.** The reference is shared with core and rendered per language, so an API entry is
documented when the core docs have it without a `* langs:` line that excludes the language. Entries
marked `* langs: python` (or `java`, `csharp`) are language-specific signatures; a docs-only PR that
adds them is excluded but worth one line in "Examined and not included". Port-specific guides are
`docs/src/intro-<lang>.md`, `docs/src/library-<lang>.md` and `docs/src/test-runners-<lang>.md`; the
port README covers installation and browser versions.

**Composition.** Title the page `Playwright <Language> 1.xx API Review`. The `Area` column takes
`Client`, `Packaging`, `Library` and `Docs` instead of the core areas. Core library items get a shorter
description with a link to the core review item, the port-language snippet and the port docs link.
Order by impact as in step 3a; a client rewrite that changes private module paths or error behavior
is tier 1 or 2 depending on whether code must change.
