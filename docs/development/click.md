## Supported click scenarios

These are some clicking corner cases that we did consider and decided to support.

### Positioning

  - Element is outside of the viewport.
    ```html
    <div style="height: 2000px;">Some content</div>
    <button>Click me</button>
    ```

    We use `scrollRectIntoViewIfNeeded` to scroll the element into the viewport if at all possible.

  - Empty element with non-empty pseudo.

    ```html
    <style>span::before { content: 'q'; }</style>
    <span></span>
    ```

    We retrieve the actual visible regions of the target element and click at the pseudo.

  - Some part of the element is always outside of the viewport.

    ```html
    <style> i { position: absolute; top: -1000px; } </style>
    <span><i>one</i><b>two</b></span>
    ```

    We retrieve the actual visible regions of the target element and click at the visible part.

  - Inline element is wrapped to the next line.

    We retrieve the actual visible regions of the target element and click at one of the inline boxes.

  - Element is rotated with transform.

    ```html
    <button style="transform: rotate(50deg);">Click me</button>
    ```

    We retrieve the actual visible regions of the target element and click at the transformed visible point.

  - Element is deep inside the iframes and/or shadow dom.

    We click it.

### Dynamic changes

  - Element appears dynamically using display or visibility.
    ```html
    <button style="display: none">Click me</button>
    <script>
      setTimeout(() => document.querySelector('button').style.display = 'inline', 5000);
    </script>
    ```

    We wait for the element to be visible before clicking.

  - Element is animating in.

    ```html
    <style>
    @keyframes move { from { marign-left: 0; } to { margin-left: 100px; } }
    </style>
    <button style="animation: 3s linear move forwards;">Click me</button>
    ```

    We wait for the element to stop moving before clicking.

  - Another element is temporary obscuring the target element.

    ```html
    <style>
      .overlay {
        position: absolute;
        left: 0; top: 0; right: 0; bottom: 0;
        background: rgba(128, 128, 128, 0.5);
        transition: opacity 1s;
      }
    </style>
    <div style="position: relative;">
      <button>Click me</button>
      <div class=overlay></div>
    </div>
    <script>
      const div = document.querySelector('.overlay');
      div.addEventListener('click', () => {
        div.style.opacity ='0';
        setTimeout(() => { div.remove(); }, 1000);
      });
    </script>
    ```

    For example, the dialog is dismissed and is slowly fading out. We wait for the obscuring element to disappear.
    More precisely, we wait for the target element to actually receive pointer events.

  - Element is replaced with another one after animation.

    ```html
    <style>
    @keyframes move { from { marign-left: 0; } to { margin-left: 100px; } }
    </style>
    <button style="animation: 3s linear move forwards;">Click me</button>
    <script>
    setTimeout(() => {
      const button = document.createElement('button');
      button.textContent = 'Click me';
      document.querySelector('button').replaceWith(button);
    }, 2500);
    </script>
    ```

    We wait for the element to be at a stable position, detect that it has been removed from the DOM and retry.

### Targeting

  - Button with span/label inside that has `pointer-events: none`.

    ```html
    <button>
      <label style="pointer-events:none">Click target</label>
    </button>
    ```

    We assume that in such a case the first parent receiving pointer events is a click target.
    This is very convenient with something like `text=Click target` selector that actually targets the inner element.


## Unsupported click scenarios

These are some clicking corner cases that we considered.

Some scenarios are marked as a bug in the web page - we believe that the page should be fixed because the real user will suffer the same issue. We try to throw when it's possible to detect the issue or timeout otherwise.

Other scenarios are perfectly fine, but we cannot support them, and usually suggest another way to handle. If Playwright logic does not work on your page, passing `{force: true}` option to the click will force the click without any checks. Use it when you know that's what you need.

### Positioning

  - Element moves outside of the viewport in onscroll.

    ```html
    <div style="height: 2000px;">Some content</div>
    <button>Click me</button>
    <script>
    window.addEventListener('scroll', () => {
      window.h = (window.h || 2000) + 200;
      document.querySelector('div').style.height = window.h + 'px';
    });
    </script>
    ```

    We consider this a bug in the page and throw.

### Dynamic changes

  - Element is constantly animating.

    ```html
    <style>
    @keyframes move { from { marign-left: 0; } to { margin-left: 100px; } }
    200px; } }
    </style>
    <button style="animation: 3s linear move infinite;">Click me</button>
    ```

    We wait for the element to be at a stable position and timeout. A real user would be able to click in some cases.

  - Element is animating in, but temporarily pauses in the middle.

    ```html
    <style>
    @keyframes move { 0% { marign-left: 0; } 25% { margin-left: 100px; } 50% { margin-left: 100px;} 100% { margin-left: 200px; } }
    </style>
    <button style="animation: 3s linear move forwards;">Click me</button>
    ```

    We click in the middle of the animation and could actually click at the wrong element. We do not detect this case and do not throw. A real user would probably retry and click again.

  - Element is removed or hidden after `fetch` / `xhr` / `setTimeout`.

    ```html
    <button>Click me</button>
    <script>
    fetch(location.href).then(() => document.querySelector('button').remove());
    </script>
    ```

    We click the element and might be able to misclick. We do not detect this case and do not throw.

    This is a typical flaky failure, because the network fetch is racing against the input driven by Playwright. The suggested solution is to wait for the response to arrive, and only then click. For example, consider a filtered list with a "Apply filters" button that fetches new data, removes all items from the list and inserts new ones.

    ```js
    await Promise.all([
      // This click triggers network fetch racing with next click.
      page.click('text=Apply filters'),
      // This waits for the network response to arrive.
      page.waitForResponse('**/filtered?*'),
    ]);
    // Safe to click now, because network response has been processed
    // and items in the list have been updated.
    await page.click('.list-item');
    ```


### Targeting

  - A transparent overlay handles the input targeted at the content behind it.

    ```html
    <div style="position: relative;">
      <span>Click me</span>
      <div style="position: absolute; left: 0; top: 0; right: 0; bottom: 0" onclick="..."></div>
    </div>
    ```

    We consider the overlay temporary and timeout waiting for it to disappear.
    When the overlay element is actually handling the input instead of the target element, use `{force: true}` option to skip the checks and click anyway.

  - Hover handler creates an overlay.

    ```html
    <style>
      .overlay { display: none; }
      .container:hover > .overlay { display: block; }
    </style>
    <div class=container style="position: relative;">
      <button>Click me</button>
      <div class=overlay style="position: absolute; left: 0; top: 0; right: 0; bottom: 0; background: red"></div>
    </div>
    ```

    We consider this a bug in the page, because in most circumstances users will not be able to click the element.
    When the overlay element is actually handling the input instead of the target element, use `{force: true}` option to skip the checks and click anyway.

  - `pointer-events` changes dynamically.

    ```html
    <button style="pointer-events: none">Click me</button>
    <script>
      setTimeout(() => document.querySelector('button').style.pointerEvents = 'auto', 5000);
    </script>
    ```

    We consider this a bug in the page, because users will not be able to click the element when they see it.

