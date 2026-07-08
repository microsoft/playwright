# class: Clipboard
* since: v1.62

Provides a virtual clipboard for the [BrowserContext]. Access it via
[`property: BrowserContext.clipboard`].

The virtual clipboard is installed into every page in the context the first time it is written to —
call [`method: Clipboard.install`] to opt in explicitly, or write via [`method: Clipboard.writeText`]
or [`method: Clipboard.write`]. Reading does not install it. Until it is installed, pages keep using
the real clipboard, so tests that only exercise keyboard shortcuts are unaffected. It needs no
clipboard permissions or secure context and never touches the operating system clipboard.

Once installed, it redirects `navigator.clipboard` (only where the browser already exposes it, i.e.
secure contexts), replaces `document.execCommand('copy'|'cut'|'paste')`, and intercepts native
copy/cut/paste keyboard shortcuts (for example `Control+C`/`Control+V`). Copy, cut, and paste dispatch
a real `ClipboardEvent` whose `clipboardData` page handlers can read and override, matching the browser.
Plain text, rich `text/html`, and binary content such as images are supported, and the store is shared
by every page in the context, so a value written in one page can be read in another.

Playwright does not fabricate `navigator.clipboard` or `ClipboardItem` where the browser does not
expose them, so feature detection and code paths that handle a missing clipboard API keep behaving as
they would without Playwright.

Native copy/paste interception relies on event listeners installed when a document loads, so it does
not apply to documents replaced via [`method: Page.setContent`] (which resets the document); navigate
to a page instead. In Firefox, a `paste` handler cannot read `clipboardData` from the synthesized
event — read the pasted value from the DOM or [`method: Clipboard.read`] instead.

```js
await context.clipboard.writeText('hello');
const text = await context.clipboard.readText();
```

Because the clipboard is virtual, it does not interact with the real operating system clipboard.

## async method: Clipboard.install
* since: v1.62

Installs the virtual clipboard into the context's pages. Writing to the clipboard (via
[`method: Clipboard.writeText`] or [`method: Clipboard.write`]) installs it implicitly; reading does
not. Call this to opt in before a page performs clipboard actions you want to capture (for example
native `Control+C`/`Control+V`) without first writing to it.

**Usage**

```js
await context.clipboard.install();
```

## async method: Clipboard.readText
* since: v1.62
- returns: <[string]>

Returns the current plain-text contents of the virtual clipboard.

**Usage**

```js
const text = await context.clipboard.readText();
```

## async method: Clipboard.writeText
* since: v1.62

Writes the given plain text to the virtual clipboard.

**Usage**

```js
await context.clipboard.writeText('hello');
```

### param: Clipboard.writeText.text
* since: v1.62
- `text` <[string]>

Text to write to the clipboard.

## async method: Clipboard.read
* since: v1.62
- returns: <[Array]<[Object]>>
  - `mimeType` <[string]> The MIME type of the entry, for example `text/plain` or `image/png`.
  - `buffer` <[Buffer]> The entry's contents.

Returns every entry currently on the virtual clipboard, including binary types such as images. For
plain text, [`method: Clipboard.readText`] is a convenient shortcut.

**Usage**

```js
const items = await context.clipboard.read();
```

## async method: Clipboard.write
* since: v1.62

Replaces the virtual clipboard contents with the given entries. Use this for binary types such as
images; for plain text, [`method: Clipboard.writeText`] is a convenient shortcut.

**Usage**

```js
await context.clipboard.write([
  { mimeType: 'image/png', buffer: await page.screenshot() },
]);
```

### param: Clipboard.write.items
* since: v1.62
- `items` <[Array]<[Object]>>
  - `mimeType` <[string]> The MIME type of the entry, for example `text/plain` or `image/png`.
  - `buffer` <[Buffer]> The entry's contents.

Entries to write to the clipboard.
