---
name: playwright-release-notes
description: Write the release notes for a Playwright release - the Node.js notes in docs/src/release-notes-js.md together with the Python, Java and .NET translations, and the GitHub markdown for each language's release. Use when asked to write, translate or publish release notes.
---

# Release notes

In this skill, `1.xx` is the release (for example `1.64`).

Every release has a `## Version 1.xx` section in four files in `docs/src/`:

| Language | Notes | Docs base URL | GitHub release in |
|---|---|---|---|
| Node.js | `release-notes-js.md` | `https://playwright.dev/docs/` | `microsoft/playwright` |
| Python | `release-notes-python.md` | `https://playwright.dev/python/docs/` | `microsoft/playwright-python` |
| Java | `release-notes-java.md` | `https://playwright.dev/java/docs/` | `microsoft/playwright-java` |
| .NET | `release-notes-csharp.md` | `https://playwright.dev/dotnet/docs/` | `microsoft/playwright-dotnet` |

Write the Node.js notes and the three translations in the same PR, so every language has its notes when it starts its release. The language repos then add only their own significant changes, and each one writes its GitHub release from its section (step 3).

## 1. Node.js notes

In `docs/src/release-notes-js.md`, add a `## Version 1.xx` section above the previous version, and use previous versions as a guide:

- Highlights come first, each with an emoji heading and a short sample. Ask teammates for help with them.
- Then `### New APIs` with `####` groups, `### Breaking Changes ⚠️`, `### Announcements` and `### Browser Versions`. Print the browser versions with `node utils/print_versions.js`.
- Refer to APIs with docs link macros: `` [`method: Page.frameLocator`] ``, `` [`property: Page.webmcp`] ``, `` [`event: Page.dialogClosed`] ``, `` [`option: Tracing.start.ariaSnapshots`] ``, `[Locator]`. Each language's docs show them with that language's names.
- Link other docs pages with relative paths: `[test locks](./test-parallel.md#test-locks)`.

## 2. Python, Java and .NET translations

In each of `release-notes-python.md`, `release-notes-java.md` and `release-notes-csharp.md`, add a `## Version 1.xx` section above the previous version. Translate it from the Node.js section. Compare the `Version 1.63` sections of the files to see what past translations dropped and changed.

For every language:

- Keep the structure: highlights with emoji headings, `### New APIs` with `####` groups, `### Breaking Changes ⚠️`, `### Announcements` and `### Browser Versions`.
- Remove what the language does not have:
  - the test runner: `@playwright/test`, `test.*`, config, fixtures, projects, reporters and `npx playwright test` options
  - UI mode, the HTML report, component testing and the VS Code extension
  - TypeScript-only features (generics, JSX, `tsconfig`) and `devices` descriptors
  - every API whose `langs` excludes the language (`python`, `java`, `csharp`). Check `langs` in `docs/src/api/`; options shared between methods are defined in `docs/src/api/params.md`.
- Use the language's API where it differs from Node.js:
  - A language-specific option has its own `langs`. For example, `recordVideoFps` is `langs: csharp, java, python`, while Node.js has `recordVideo.fps`.
  - `alias-<lang>` renames a member, e.g. `alias-java: isVisible` for `LocatorAssertions.toBeVisible`.
  - The generated APIs in sibling checkouts confirm the names: `../playwright-python/playwright/sync_api/_generated.py`, `../playwright-java/playwright/src/main/java/com/microsoft/playwright/` and `../playwright-dotnet/src/Playwright/API/Generated/`.
- When a Node.js sample shows a library feature through `playwright.config.ts`, show the API call instead. For example, the 1.64 video config became calls to `Screencast.start` and `Screencast.showActions`.
- Keep API links as docs link macros, and link the language's own option where it differs (`` [`option: Browser.newContext.recordVideoFps`] ``). In plain text, use the language's names.
- A relative link must point to a page that exists in the language: `*-js.md` pages are Node.js only. `npm run doc` reports broken links for each language.
- Do not add changes that only a language port made. The language repo adds those to its notes.

Rewrite code samples in each language's style. The `infra` workflow checks the syntax of `python`, `java` and `csharp` snippets.

### Python

- Use the sync API: `page.get_by_role("button").click()`. Use snake_case names and Python values (`True`, `False`, `None`).
- Options become keyword arguments: `page.get_by_role("button", name="Save")`. Objects and arrays become dicts and lists: `size={"width": 1920, "height": 1080}`.
- Aria roles and other string values stay strings: `"button"`, `"ai"`.
- Events: `page.on("dialogclosed", handler)`. Assertions: `expect(locator).to_have_text([...])`. Print with `print(...)`.
- Use the `alias-python` names: `route.continue_()`, `locator.or_()`, `page.expect_request()`.
- Commands: write `playwright install`, not `npx playwright install`.

### Java

| Node.js | Java |
|---|---|
| `await page.goto('...')` | `page.navigate("...");`: no `await`, double quotes, semicolons, typed locals (`Locator dialog = ...`) |
| `page.getByRole('button', { name: 'Save' })` | `page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Save"))` |
| options object `{ path: 'video.webm', fps: 60 }` | options builder `new Screencast.StartOptions().setPath(Paths.get("video.webm")).setFps(60)` |
| object literal `{ name: 'session-id', value: '42', url }` | value class `new Cookie("session-id", "42").setUrl(url)` |
| `['a', 'b']`, `{ a: 2 }` | `Arrays.asList("a", "b")`, `Map.of("a", 2)`; `new String[] {"a", "b"}` for assertion arguments |
| property `page.webmcp`, `context.tracing` | getter `page.webmcp()`, `context.tracing()` |
| event `page.on('dialogclosed', handler)` | `page.onDialogClosed(handler)` |
| `expect(locator).toHaveText(...)` | `assertThat(locator).hasText(...)`. Likewise `toBeX` → `isX`, `toHaveX` → `hasX`, `toContainX` → `containsX`, `toMatchX` → `matchesX` |
| `route.continue()` and other members with `alias-java` | the alias, e.g. `route.resume()` |
| `npx playwright install --no-remove` | `mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install --no-remove"` |
| "array", `undefined`, `'ai'` in prose | "list", `null`, `"ai"` |

### .NET

| Node.js | .NET |
|---|---|
| `await page.goto('...')` | `await page.GotoAsync("...");`: PascalCase members, `Async` suffix on async methods, `var` locals, double quotes, semicolons |
| `page.getByRole('button', { name: 'Save' })` | `page.GetByRole(AriaRole.Button, new() { Name = "Save" })` |
| options object `{ path: 'video.webm', fps: 60 }` | options initializer `new() { Path = "video.webm", Fps = 60 }` |
| nested object `size: { width: 1920, height: 1080 }` | `Size = new() { Width = 1920, Height = 1080 }` |
| object literal `{ name: 'session-id', value: '42', url }` | `new Cookie { Name = "session-id", Value = "42", Url = url }` |
| `['a', 'b']`, free-form object `{ a: 2 }` | `new[] { "a", "b" }`, anonymous object `new { a = 2 }` |
| string-literal union value `'ai'`, `'button'` | enum member `AriaSnapshotMode.Ai`, `AriaRole.Button` |
| property `page.webmcp`, `context.tracing` | property `page.Webmcp`, `context.Tracing` |
| event `page.on('dialogclosed', handler)` | `page.DialogClosed += (_, dialog) => { ... };` |
| `expect(locator).toHaveText(...)` | `await Expect(locator).ToHaveTextAsync(...);` |
| `console.log(x)` | `Console.WriteLine(x);` |
| members with `alias-csharp` | the alias, e.g. `page.request` → `page.APIRequest` |
| union-typed option, e.g. `httpCredentials` as a list | one property per type, e.g. `HttpCredentialsList` |
| `npx playwright install --no-remove` | `pwsh bin/Debug/netX/playwright.ps1 install --no-remove` |
| option names in prose (`fontSize`), `undefined` | `FontSize`, `null` |

Open one PR for all four files, titled `docs: release notes for v1.xx`. After it merges, cherry-pick it to `release-1.xx` with the `playwright-cherry-pick` skill.

## 3. GitHub release markdown

Each repo publishes the GitHub release for its language, with markdown converted from its `## Version 1.xx` section on `release-1.xx`. Convert the notes yourself:

- Leave out the `## Version 1.xx` heading. Move every other heading up one level (`###` becomes `##`, `####` becomes `###`).
- Replace each link macro with a full link: the language's docs base URL from the table at the top, plus the path below. Use the language's name as the link text:

  | Macro | Path after the docs base URL | Node.js | Python | Java | .NET |
  |---|---|---|---|---|---|
  | `[Locator]` | `api/class-locator` | `Locator` | `Locator` | `Locator` | `Locator` |
  | `` [`method: Page.frameLocator`] `` | `api/class-page#page-frame-locator` | `page.frameLocator()` | `page.frame_locator()` | `page.frameLocator()` | `Page.FrameLocator()` |
  | `` [`method: Page.ariaSnapshot`] `` | `api/class-page#page-aria-snapshot` | `page.ariaSnapshot()` | `page.aria_snapshot()` | `page.ariaSnapshot()` | `Page.AriaSnapshotAsync()` |
  | `` [`method: Locator.first`] `` | `api/class-locator#locator-first` | `locator.first()` | `locator.first` | `locator.first()` | `Locator.First` |
  | `` [`property: Page.webmcp`] `` | `api/class-page#page-webmcp` | `page.webmcp` | `page.webmcp` | `page.webmcp()` | `Page.Webmcp` |
  | `` [`event: BrowserContext.dialogClosed`] `` | `api/class-browsercontext#browser-context-event-dialog-closed` | `browserContext.on('dialogclosed')` | `browser_context.on("dialogclosed")` | `browserContext.onDialogClosed()` | `BrowserContext.DialogClosed` |
  | `` [`method: LocatorAssertions.toBeVisible`] `` | `api/class-locatorassertions#locator-assertions-to-be-visible` | `expect(locator).toBeVisible()` | `expect(locator).to_be_visible()` | `assertThat(locator).isVisible()` | `Expect(Locator).ToBeVisibleAsync()` |
  | `` [`option: Page.content.includeShadow`] `` | `api/class-page#page-content-option-include-shadow` | `` `includeShadow` `` | `` `include_shadow` `` | `` `includeShadow` `` | `` `IncludeShadow` `` |
  | `[Playwright MCP](./getting-started-mcp.md)` | `getting-started-mcp` | `Playwright MCP` | `Playwright MCP` | `Playwright MCP` | `Playwright MCP` |

- An image `![alt](./images/foo.png)` becomes `![alt](https://github.com/microsoft/playwright/blob/main/docs/src/images/foo.png?raw=true)` in every language.

The page is `class-` and the class name in lower case. The anchor is the class and member names in kebab-case, so `APIRequestContext.addCookies` becomes `api-request-context-add-cookies`. Options add `-option-<name>`, and events add `-event-<name>`. Anchors use the names from `docs/src/api/` even where a language renames the member, so Java's `isVisible()` links to `#locator-assertions-to-be-visible`.

The link text follows the language:

- **Node.js:** the class in lower camel case (`page`, `apiRequestContext`, `testConfig`). Methods get `()`, properties none, events become `on('<event in lower case>')`, and assertions start with `expect(locator).`, `expect(page).` or `expect(response).`.
- **Python:** the class and member in snake_case (`browser_context`, `api_request_context`). Methods get `()`. A member is a property, without `()`, if `_generated.py` declares it with `@property`. Events become `on("<event in lower case>")`, and assertions start with `expect(locator).`.
- **Java:** the class in lower camel case and the `alias-java` member name. Methods and properties get `()`, events become `on<Event>()`, and assertions start with `assertThat(locator).`.
- **.NET:** the class without the interface `I` (`Page`, `APIRequestContext`) and the member exactly as the generated `I<Class>.cs` declares it. Async methods take the `Async` suffix and `()`, sync methods get `()`, and properties and events get no parentheses. Assertions start with `Expect(Locator).`.

Check that every link resolves. playwright.dev already documents the release once the Node.js docs roll has landed. It serves minified HTML, so an anchor may appear without quotes (`id=page-webmcp>`):

```bash
grep -oE 'https://playwright\.dev/[^) ]+' <notes-file> | sort -u | while read -r url; do
  page=${url%%#*}
  html=$(curl -sfL "$page") || { echo "MISSING PAGE   $url"; continue; }
  if [[ "$url" == *"#"* ]]; then
    anchor=${url#*#}
    grep -qE "id=\"?${anchor}[\" >]" <<<"$html" || echo "MISSING ANCHOR $url"
  fi
done
```

Then scan for anything that wasn't converted, and for stray spaces inside link text (`[Page. DialogClosed]`, `` [`HttpCredentialsList `] ``). The first command applies to every language; then run the one for the language. They should print nothing:

```bash
# every language
grep -nE '\[`(method|property|event|option|param): |\]\(\./|\[[A-Z][A-Za-z]*\]([^(]|$)|\[[A-Za-z_]+\. |\[`[^`]+ `\]' <notes-file>
# Python: camelCase names in link text
grep -nE '\[[a-z_]+\.[a-z_]*[A-Z]|\[`[a-z]+[A-Z]' <notes-file>
# Java: JS-style events, assertions and properties
grep -nE "\.on\('|\b(toBe|toHave|toContain|toMatch)[A-Z]|\bawait\b|\barray\b|\bundefined\b|\[[a-z][A-Za-z]*\.[a-z][A-Za-z]*\]\(" <notes-file>
# .NET: lower-case classes or members, JS-style events
grep -nE "\.on\('|\bundefined\b|\[[a-z][A-Za-z]*\.|\[[A-Z][A-Za-z]*\.[a-z]|\[Expect\([a-z]" <notes-file>
```

If the conversion shows a problem in the notes themselves, such as an API the language does not have or a sample in the wrong style, fix the notes too (step 2). Otherwise the problem stays on playwright.dev.
