---
id: debug-selectors
title: "Debugging Selectors"
---

Playwright will throw a timeout exception like `locator.click: Timeout 30000ms exceeded` when an element does not exist on the page. There are multiple ways of debugging selectors:

- [Playwright Inspector](#using-playwright-inspector) to step over each Playwright API call to inspect the page.
- [Browser DevTools](#using-devtools) to inspect selectors with the DevTools element panel.
- [Trace Viewer](./trace-viewer.md) to see what the page looked like during the test run.
- [Verbose API logs](#verbose-api-logs) shows [actionability checks](./actionability.md) when locating the element.

## Using Playwright Inspector

Open the [Playwright Inspector](./debug.md) and click the `Explore` button to hover over elements in the screen and click them to
automatically generate selectors for those elements. To verify where selector points, paste it into the inspector input field:

<img width="602" alt="Selectors toolbar" src="https://user-images.githubusercontent.com/883973/108614696-ad5eaa00-73b1-11eb-81f5-9eebe62543a2.png"></img>

## Using DevTools

You can also use the following API inside the Developer Tools Console of any browser.

When running in Debug Mode with `PWDEBUG=console`, a `playwright` object is available in Developer tools console.

1. Run with `PWDEBUG=console`
1. Setup a breakpoint to pause the execution
1. Open the console panel in browser developer tools

<img src="https://user-images.githubusercontent.com/284612/92536317-37dd9380-f1ee-11ea-875d-daf1b206dd56.png"></img>

### playwright.$(selector)

Query Playwright selector, using the actual Playwright query engine, for example:

```txt
> playwright.$('.auth-form >> text=Log in');

<button>Log in</button>
```

### playwright.$$(selector)

Same as `playwright.$`, but returns all matching elements.

```txt
> playwright.$$('li >> text=John')

> [<li>, <li>, <li>, <li>]
```

### playwright.inspect(selector)

Reveal element in the Elements panel (if DevTools of the respective browser supports it).

```txt
> playwright.inspect('text=Log in')
```

### playwright.locator(selector)

Query Playwright element using the actual Playwright query engine, for example:

```txt
> playwright.locator('.auth-form', { hasText: 'Log in' });

> Locator ()
>   - element: button
>   - elements: [button]
```

### playwright.highlight(selector)

Highlight the first occurrence of the locator:

```txt
> playwright.highlight('.auth-form');
```

### playwright.clear()

```txt
> playwright.clear()
```

Clear existing highlights.

### playwright.selector(element)

Generates selector for the given element.

```txt
> playwright.selector($0)

"div[id="glow-ingress-block"] >> text=/.*Hello.*/"
```

## Verbose API logs

Playwright supports verbose logging with the `DEBUG` environment variable.

```bash tab=bash-bash lang=js
DEBUG=pw:api npx playwright test
```

```batch tab=bash-batch lang=js
set DEBUG=pw:api
npx playwright test
```

```powershell tab=bash-powershell lang=js
$env:DEBUG="pw:api"
npx playwright test
```

```bash tab=bash-bash lang=java
DEBUG=pw:api mvn test
```

```batch tab=bash-batch lang=java
set DEBUG=pw:api
mvn test
```

```powershell tab=bash-powershell lang=java
$env:DEBUG="pw:api"
mvn test
```

```bash tab=bash-bash lang=python
DEBUG=pw:api pytest -s
```

```batch tab=bash-batch lang=python
set DEBUG=pw:api
pytest -s
```

```powershell tab=bash-powershell lang=python
$env:DEBUG="pw:api"
pytest -s
```

```bash tab=bash-bash lang=csharp
DEBUG=pw:api dotnet run
```

```batch tab=bash-batch lang=csharp
set DEBUG=pw:api
dotnet run
```

```powershell tab=bash-powershell lang=csharp
$env:DEBUG="pw:api"
dotnet run
```
