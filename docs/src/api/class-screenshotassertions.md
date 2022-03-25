# class: ScreenshotAssertions
* langs: js

Playwright provides methods for comparing page and element screenshots with
expected values stored in files. See also [`method: PageAssertions.toHaveScreenshot`] and
[`LocatorAssertions.toHaveScreenshot`].

```js
expect(screenshot).toMatchSnapshot('landing-page.png');
```

<!-- TOC -->

## method: ScreenshotAssertions.toMatchSnapshot

Ensures that passed value, either a [string] or a [Buffer], matches the expected snapshot stored in the test snapshots directory.

```js
// Basic usage.
expect(await page.screenshot()).toMatchSnapshot('landing-page.png');

// Configure image matching threshold.
expect(await page.screenshot()).toMatchSnapshot('landing-page.png', { threshold: 0.3 });

// Bring some structure to your snapshot files by passing file path segments.
expect(await page.screenshot()).toMatchSnapshot(['landing', 'step2.png']);
expect(await page.screenshot()).toMatchSnapshot(['landing', 'step3.png']);
```

Learn more about [visual comparisons](../test-snapshots.md).

### param: ScreenshotAssertions.toMatchSnapshot.name
- `name` <[string]|[Array]<[string]>>

Snapshot name.

### option: ScreenshotAssertions.toMatchSnapshot.maxDiffPixels = %%-assertions-max-diff-pixels-%%

### option: ScreenshotAssertions.toMatchSnapshot.maxDiffPixelRatio = %%-assertions-max-diff-pixel-ratio-%%

### option: ScreenshotAssertions.toMatchSnapshot.threshold = %%-assertions-threshold-%%
