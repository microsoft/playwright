## Supported click scenarios

These are some of the corner cases that Playwright aims to support.

### Positioning

  - Element is outside of the viewport.
    ```html
    <div style="height: 2000px;">Some content</div>
    <button>Click me</button>
    ```

    Playwright scrolls the element into the viewport if at all possible.

  - Empty element with non-empty pseudo.

    ```html
    <style>span::before { content: 'q'; }</style>
    <span></span>
    ```

    Playwright retrieves the actual visible regions of the target element and clicks at the pseudo.

  - Some part of the element is always outside of the viewport.

    ```html
    <style> i { position: absolute; top: -1000px; } </style>
    <span><i>one</i><b>two</b></span>
    ```

    Playwright retrieves the actual visible regions of the target element and clicks at the visible part.

  - Inline element is wrapped to the next line.

    Playwright retrieves the actual visible regions of the target element and clicks at one of the inline boxes.

  - Element is rotated with transform.

    ```html
    <button style="transform: rotate(50deg);">Click me</button>
    ```

    Playwright retrieve the actual visible regions of the target element and clicks at the transformed visible point.

  - Element is deep inside the iframes and/or shadow dom.

    Playwright just clicks it.

### Dynamic changes

  - Element appears dynamically using display or visibility.
    ```html
    <button style="display: none">Click me</button>
    <script>
      setTimeout(() => document.querySelector('button').style.display = 'inline', 5000);
    </script>
    ```

    Playwright waits for the element to be visible before clicking.

  - Element is animating in.

    ```html
    <style>
    @keyframes move { from { marign-left: 0; } to { margin-left: 100px; } }
    </style>
    <button style="animation: 3s linear move forwards;">Click me</button>
    ```

    Playwright waits for the element to stop moving before clicking.

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

    For example, the dialog is dismissed and is slowly fading out. Playwright waits for the obscuring element to disappear.
    More precisely, it waits for the target element to actually receive pointer events.

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

    Playwright waits for the element to be at a stable position, detects that it has been removed from the DOM and retries.

### Targeting

  - Element has `pointer-events: none`.

    ```html
    <label style="pointer-events:none">Click target</label>
    ```

    Playwright will wait until `pointer-events: none` goes away or times out. However, if the element is inside of a `<button>` tag, Playwright will
    wait until the button can accept pointer events.

    ```html
    <button style="pointer-events: none">
      <label>Click target</label>
    </button>
    ```


## Unsupported click scenarios

Some scenarios here are marked as a bug in the web page - we believe that the page should be fixed because the real user will suffer the same issue. Playwright tries to throw when it's possible to detect the issue or timeout otherwise.

Other scenarios are perfectly fine, but Playwright cannot support them, and we usually suggest another way to handle. If Playwright logic does not work on your page, passing `{force: true}` option to the click will force the click without any checks. Use it when you know that's what you need.

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

    Playwright throws, considering this a bug in the page.

### Dynamic changes

  - Element is constantly animating.

    ```html
    <style>
    @keyframes move { from { marign-left: 0; } to { margin-left: 100px; } }
    200px; } }
    </style>
    <button style="animation: 3s linear move infinite;">Click me</button>
    ```

    Playwright waits for the element to be at a stable position and times out. A real user would be able to click in some cases.

  - Element is animating in, but temporarily pauses in the middle.

    ```html
    <style>
    @keyframes move { 0% { marign-left: 0; } 25% { margin-left: 100px; } 50% { margin-left: 100px;} 100% { margin-left: 200px; } }
    </style>
    <button style="animation: 3s linear move forwards;">Click me</button>
    ```

    Playwright clicks in the middle of the animation and could actually click at the wrong element. Playwright does not detect this case and does not throw. A real user would probably retry and click again.

  - Element is removed or hidden after `fetch` / `xhr` / `setTimeout`.

    ```html
    <button>Click me</button>
    <script>
    fetch(location.href).then(() => document.querySelector('button').remove());
    </script>
    ```

    Playwright clicks the element, and might be able to misclick because it is already hidden. Playwright does not detect this case and does not throw.

    This is a typical flaky failure, because the network fetch is racing against the input driven by Playwright. We suggest to wait for the response to arrive, and click after that. For example, consider a filtered list with an "Apply filters" button that fetches new data, removes all items from the list and inserts new ones.

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

    Playwright considers the overlay temporary and times out while waiting for the overlay to disappear.
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
